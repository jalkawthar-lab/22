document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initSidebar();
  loadOrders();
  loadAcceptedOrders();
  initProductsTab();
  initCategoriesTab();
  initBannersTab();
  initSettingsTab();

  // Add Firebase loaded listener for initial sync and realtime orders
  window.addEventListener("firebaseReady", () => {
    listenForOrders();
    syncAllDataFromFirestore(); // Fetch data from Firebase when the page loads
  });
});

async function updateAdminCacheVersion() {
  if (window.db && window.firestore) {
    try {
      await window.firestore.setDoc(
        window.firestore.doc(window.db, "meta", "version"),
        {
          updatedAt: window.firestore.serverTimestamp(),
        },
      );
      console.log("Firebase cache version updated");
    } catch (e) {
      console.error("Error updating meta version:", e);
    }
  }
}

async function syncItemToFirestore(collectionName, itemData, action) {
  if (window.db && window.firestore) {
    try {
      if (action === "delete") {
        if (itemData.firestoreId) {
          await window.firestore.deleteDoc(
            window.firestore.doc(
              window.db,
              collectionName,
              itemData.firestoreId,
            ),
          );
        } else {
          // Fallback to local id string if no firestoreId
          const querySnap = await window.firestore.getDocs(
            window.firestore.collection(window.db, collectionName),
          );
          querySnap.forEach(async (docSnap) => {
            if (docSnap.data().id === itemData.id) {
              await window.firestore.deleteDoc(docSnap.ref);
            }
          });
        }
      } else if (action === "add") {
        await window.firestore.addDoc(
          window.firestore.collection(window.db, collectionName),
          itemData,
        );
      } else if (action === "update") {
        if (itemData.firestoreId) {
          await window.firestore.updateDoc(
            window.firestore.doc(
              window.db,
              collectionName,
              itemData.firestoreId,
            ),
            itemData,
          );
        } else {
          const querySnap = await window.firestore.getDocs(
            window.firestore.collection(window.db, collectionName),
          );
          querySnap.forEach(async (docSnap) => {
            if (docSnap.data().id === itemData.id) {
              await window.firestore.updateDoc(docSnap.ref, itemData);
            }
          });
        }
      }
      await updateAdminCacheVersion();
    } catch (e) {
      console.error(`Firebase error on ${collectionName}:`, e);
      console.error(
        `An error occurred while saving ${collectionName} in Firebase (Database Rules may prevent writing): ${e.message}`,
      );
    }
  } else {
    console.warn(
      "Firebase is not ready yet. Please wait a few seconds and try again.",
    );
  }
}

function listenForOrders() {
  if (window.db && window.firestore) {
    window.firestore.onSnapshot(
      window.firestore.collection(window.db, "orders"),
      (snapshot) => {
        let firestoreOrders = [];
        snapshot.forEach((doc) => {
          firestoreOrders.push({ firestoreId: doc.id, ...doc.data() });
        });
        // Merge or assign to pending based on status
        const pendingOrders = firestoreOrders.filter(
          (o) => o.status === "pending",
        );
        const acceptedOrders = firestoreOrders.filter(
          (o) => o.status === "accepted",
        );
        localStorage.setItem("pendingOrders", JSON.stringify(pendingOrders));
        localStorage.setItem("acceptedOrders", JSON.stringify(acceptedOrders));
        loadOrders();
        if (typeof loadAcceptedOrders === "function") loadAcceptedOrders();
      },
    );
  }
}

// Fetch active data from Firestore and update the control panel layout
async function syncAllDataFromFirestore() {
  if (window.db && window.firestore) {
    try {
      // Fetch products
      const productsSnap = await window.firestore.getDocs(window.firestore.collection(window.db, "products"));
      let fetchedProducts = [];
      productsSnap.forEach((doc) => {
        fetchedProducts.push({ firestoreId: doc.id, ...doc.data() });
      });
      localStorage.setItem("products", JSON.stringify(fetchedProducts));

      // Fetch categories
      const categoriesSnap = await window.firestore.getDocs(window.firestore.collection(window.db, "categories"));
      let fetchedCategories = [];
      categoriesSnap.forEach((doc) => {
        fetchedCategories.push({ firestoreId: doc.id, ...doc.data() });
      });
      localStorage.setItem("categories", JSON.stringify(fetchedCategories));

      // Fetch banners
      if (window.firestore.getDoc) {
        const bannersDoc = await window.firestore.getDoc(window.firestore.doc(window.db, "meta", "banners"));
        if (bannersDoc.exists && bannersDoc.exists()) {
          localStorage.setItem("banners", JSON.stringify(bannersDoc.data().data || []));
        }
      }

      // Update UI elements
      populateCategorySelects();
      loadAdminProducts();
      loadAdminCategories();
      loadAdminBanners();
      console.log("Data synced successfully from Firestore");
    } catch (e) {
      console.error("Error syncing data from Firestore:", e);
    }
  }
}

function initTabs() {
  const tabs = document.querySelectorAll(".sidebar-menu li");
  const contents = document.querySelectorAll(".tab-content");
  const headerTitle = document.querySelector(".top-header h3");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      // Remove active states from all tabs
      tabs.forEach((t) => t.classList.remove("active"));
      contents.forEach((c) => c.classList.remove("active"));

      // Add active state to the selected tab
      tab.classList.add("active");
      const targetId = tab.dataset.tab + "-tab";
      document.getElementById(targetId).classList.add("active");

      // Update header title context
      if (headerTitle) {
        headerTitle.innerText = tab.innerText;
      }

      // Close mobile navigation drawer if open upon selection
      const sidebar = document.getElementById("sidebar");
      if (window.innerWidth <= 768 && sidebar) {
        sidebar.classList.remove("open");
      }
    });
  });
}

function initSidebar() {
  const toggleBtn = document.getElementById("toggle-sidebar");
  const sidebar = document.getElementById("sidebar");

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  }
}

function loadOrders() {
  const container = document.getElementById("orders-container");
  if (!container) return;

  let pendingOrders = [];
  try {
    pendingOrders = JSON.parse(localStorage.getItem("pendingOrders") || "[]");
  } catch (e) {
    console.error("Error parsing pending orders layout", e);
  }

  if (pendingOrders.length === 0) {
    container.innerHTML =
      '<div style="text-align:center; padding: 3rem; color:var(--text-muted); grid-column: 1 / -1; font-size: 1.1rem;">No pending orders available at the moment...</div>';
    return;
  }

  // Sort orders chronologically from newest to oldest
  pendingOrders.sort((a, b) => new Date(b.date) - new Date(a.date));

  container.innerHTML = "";

  // Fetch fallback customer variables from client device memory
  const cName = localStorage.getItem("checkoutName") || "Not Provided";
  const cAddress = localStorage.getItem("checkoutAddress") || "Not Provided";
  const cPhone = localStorage.getItem("checkoutPhone") || "Not Provided";
  const shippingFee = 3000;

  const colors = [
    "#e0f2fe",
    "#dcfce7",
    "#fef3c7",
    "#fee2e2",
    "#f3e8ff",
    "#ffedd5",
  ];

  pendingOrders.forEach((order, index) => {
    const orderDateObj = new Date(order.date);
    const dateOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    const orderDate = orderDateObj.toLocaleDateString("en-US", dateOptions);

    let subtotal = 0;
    let itemsHtml = "";
    order.items.forEach((item) => {
      const priceNum = parseInt(item.price.replace(/[^\d]/g, ""));
      subtotal += priceNum * item.quantity;
      itemsHtml += `
            <div class="order-item">
                <span>${item.name} (${item.quantity}x)</span>
                <span>${(priceNum * item.quantity).toLocaleString("en-US")} IQD</span>
            </div>`;
    });
    const total = subtotal + shippingFee;

    const card = document.createElement("div");
    card.className = "order-card";
    card.style.backgroundColor = colors[index % colors.length];
    card.innerHTML = `
            <div class="order-header">
                <span class="order-id">Order #${order.id.toString().slice(-5)}</span>
                <span class="order-date">${orderDate}</span>
            </div>
            <div class="order-customer">
                <div><strong>Name:</strong> ${cName}</div>
                <div><strong>Address:</strong> ${cAddress}</div>
                <div><strong>Phone:</strong> <span dir="ltr">${cPhone}</span></div>
            </div>
            <div class="order-items">
                ${itemsHtml}
            </div>
            <div class="order-total">
                Total Price: ${total.toLocaleString("en-US")} IQD
            </div>
            <div class="order-actions">
                <button class="btn btn-accept process-order-btn" data-id="${order.id}" data-action="accept">Accept</button>
                <button class="btn btn-reject process-order-btn" data-id="${order.id}" data-action="reject">Reject</button>
            </div>
        `;
    container.appendChild(card);
  });

  const processBtns = container.querySelectorAll(".process-order-btn");
  processBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = parseInt(e.currentTarget.getAttribute("data-id"));
      const action = e.currentTarget.getAttribute("data-action");
      if (typeof window.processOrder === "function") {
        window.processOrder(id, action);
      }
    });
  });
}

window.processOrder = async function (id, action) {
  let pendingOrders = JSON.parse(localStorage.getItem("pendingOrders") || "[]");
  const orderIndex = pendingOrders.findIndex((o) => o.id === id);

  if (orderIndex !== -1) {
    const order = pendingOrders[orderIndex];

    if (window.db && window.firestore && order.firestoreId) {
      try {
        if (action === "accept") {
          await window.firestore.updateDoc(
            window.firestore.doc(window.db, "orders", order.firestoreId),
            { status: "accepted" },
          );
        } else {
          await window.firestore.deleteDoc(
            window.firestore.doc(window.db, "orders", order.firestoreId),
          );
        }
      } catch (e) {
        console.error("Firestore update error: ", e);
      }
    } else {
      pendingOrders.splice(orderIndex, 1);
      localStorage.setItem("pendingOrders", JSON.stringify(pendingOrders));

      if (action === "accept") {
        let acceptedOrders = JSON.parse(
          localStorage.getItem("acceptedOrders") || "[]",
        );
        acceptedOrders.push(order);
        localStorage.setItem("acceptedOrders", JSON.stringify(acceptedOrders));
      }
    }
  }

  loadOrders();
  if (typeof loadAcceptedOrders === "function") {
    loadAcceptedOrders();
  }
};

function loadAcceptedOrders() {
  const container = document.getElementById("accepted-orders-container");
  if (!container) return;

  let acceptedOrders = [];
  try {
    acceptedOrders = JSON.parse(localStorage.getItem("acceptedOrders") || "[]");
  } catch (e) {
    console.error("Error reading accepted orders", e);
  }

  if (acceptedOrders.length === 0) {
    container.innerHTML =
      '<div style="text-align:center; padding: 3rem; color:var(--text-muted); grid-column: 1 / -1; font-size: 1.1rem;">No accepted orders available at the moment...</div>';
    return;
  }

  acceptedOrders.sort((a, b) => new Date(b.date) - new Date(a.date));

  container.innerHTML = "";

  const cName = localStorage.getItem("checkoutName") || "Not Provided";
  const cAddress = localStorage.getItem("checkoutAddress") || "Not Provided";
  const cPhone = localStorage.getItem("checkoutPhone") || "Not Provided";
  const shippingFee = parseInt(localStorage.getItem("deliveryCost")) || 3000;

  acceptedOrders.forEach((order) => {
    const orderDateObj = new Date(order.date);
    const dateOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    const orderDate = orderDateObj.toLocaleDateString("en-US", dateOptions);

    let subtotal = 0;
    let itemsHtml = "";
    order.items.forEach((item) => {
      const priceNum = parseInt(item.price.replace(/[^\d]/g, ""));
      subtotal += priceNum * item.quantity;
      itemsHtml += `
            <div class="order-item">
                <span>${item.name} (${item.quantity}x)</span>
                <span>${(priceNum * item.quantity).toLocaleString("en-US")} IQD</span>
            </div>`;
    });
    const total = subtotal + shippingFee;

    const card = document.createElement("div");
    card.className = "order-card";
    card.style.border = "1px solid #10b981";
    card.innerHTML = `
            <div class="order-header">
                <span class="order-id">Order #${order.id.toString().slice(-5)}</span>
                <span class="order-date">${orderDate}</span>
            </div>
            <div class="order-customer">
                <div><strong>Name:</strong> ${cName}</div>
                <div><strong>Address:</strong> ${cAddress}</div>
                <div><strong>Phone:</strong> <span dir="ltr">${cPhone}</span></div>
            </div>
            <div class="order-items">
                ${itemsHtml}
            </div>
            <div class="order-total">
                Total Price: ${total.toLocaleString("en-US")} IQD
            </div>
            <div class="order-actions">
                <button class="btn btn-reject delete-accepted-order-btn" data-id="${order.id}">Delete History Log</button>
            </div>
        `;
    container.appendChild(card);
  });

  const deleteBtns = container.querySelectorAll(".delete-accepted-order-btn");
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = parseInt(e.currentTarget.getAttribute("data-id"));
      if (typeof window.deleteAcceptedOrder === "function") {
        window.deleteAcceptedOrder(id);
      }
    });
  });
}

window.deleteAcceptedOrder = async function (id) {
  let acceptedOrders = JSON.parse(
    localStorage.getItem("acceptedOrders") || "[]",
  );
  const orderIndex = acceptedOrders.findIndex((o) => o.id === id);
  if (orderIndex !== -1) {
    const order = acceptedOrders[orderIndex];
    if (window.db && window.firestore && order.firestoreId) {
      try {
        await window.firestore.deleteDoc(
          window.firestore.doc(window.db, "orders", order.firestoreId),
        );
      } catch (e) {
        console.error("Firestore delete error", e);
      }
    } else {
      acceptedOrders.splice(orderIndex, 1);
      localStorage.setItem("acceptedOrders", JSON.stringify(acceptedOrders));
      loadAcceptedOrders();
    }
  }
};

// ------------------------------------
// Product Management Module
// ------------------------------------

function populateCategorySelects() {
  let categories = JSON.parse(localStorage.getItem("categories")) || [];

  const newSelect = document.getElementById("new-product-category");
  const editSelect = document.getElementById("edit-product-category");

  let html = "";
  categories.forEach((cat) => {
    html += `<option value="${cat.id}">${cat.name}</option>`;
  });

  if (newSelect) newSelect.innerHTML = html;
  if (editSelect) editSelect.innerHTML = html;
}

function initProductsTab() {
  populateCategorySelects();
  loadAdminProducts();

  const addProductBtn = document.getElementById("add-product-btn");
  const formContainer = document.getElementById("add-product-form");
  const saveBtn = document.getElementById("save-product-btn");

  if (addProductBtn) {
    addProductBtn.addEventListener("click", () => {
      if (formContainer.style.display === "none") {
        formContainer.style.display = "block";
        addProductBtn.innerText = "Cancel";
        addProductBtn.style.background = "#ef4444";
      } else {
        formContainer.style.display = "none";
        addProductBtn.innerText = "Add New Product";
        addProductBtn.style.background = "#10b981";
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const name = document.getElementById("new-product-name").value;
      const price = document.getElementById("new-product-price").value;
      const category = document.getElementById("new-product-category").value;
      const description = document.getElementById("new-product-desc").value;
      const imageInput = document.getElementById("new-product-image");
      const imageFile = imageInput.files[0];

      if (!name || !price || !category || !imageFile) {
        alert("Please complete all fields and choose an item image!");
        return;
      }

      saveBtn.innerText = "Saving item state...";
      saveBtn.disabled = true;

      compressImageFile(imageFile, function (compressedBase64) {
        try {
          let products = [];
          try {
            const saved = localStorage.getItem("products");
            if (saved) products = JSON.parse(saved);
          } catch (e) {}

          if (!products) {
            products = [];
          }

          const newId =
            products.length > 0
              ? Math.max(...products.map((p) => p.id)) + 1
              : 1;
          const formattedPrice =
            parseInt(price).toLocaleString("en-US") + " IQD";

          const newProduct = {
            id: newId,
            name: name,
            price: formattedPrice,
            image: compressedBase64,
            rating: 5,
            category: category,
            description: description
          };

          products.push(newProduct);
          localStorage.setItem("products", JSON.stringify(products));
          syncItemToFirestore("products", newProduct, "add");

          document.getElementById("new-product-name").value = "";
          document.getElementById("new-product-price").value = "";
          document.getElementById("new-product-image").value = "";
          document.getElementById("new-product-desc").value = "";
          formContainer.style.display = "none";
          addProductBtn.innerText = "Add New Product";
          addProductBtn.style.background = "#10b981";

          alert("Product added successfully!");
          loadAdminProducts();
        } catch (err) {
          console.error(err);
          alert("Error! Storage capacity limit hit.");
        } finally {
          saveBtn.innerText = "Save Product";
          saveBtn.disabled = false;
        }
      });
    });
  }
}

function loadAdminProducts() {
  const container = document.getElementById("admin-products-container");
  if (!container) return;

  if (!window.editEventsAttached) {
    const cancelBtn = document.getElementById("cancel-edit-btn");
    const updateBtn = document.getElementById("update-product-btn");

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        document.getElementById("edit-product-form").style.display = "none";
      });
    }

    if (updateBtn) {
      updateBtn.addEventListener("click", () => {
        const id = parseInt(document.getElementById("edit-product-id").value);
        const name = document.getElementById("edit-product-name").value;
        const price = document.getElementById("edit-product-price").value;
        const category = document.getElementById("edit-product-category").value;
        const description = document.getElementById("edit-product-desc").value;
        const imageInput = document.getElementById("edit-product-image");
        const imageFile = imageInput.files[0];

        if (!name || !price || !category) {
          alert("Please fill out all mandatory core fields!");
          return;
        }

        let products = JSON.parse(localStorage.getItem("products")) || [];

        const formattedPrice = parseInt(price).toLocaleString("en-US") + " IQD";
        const index = products.findIndex((p) => p.id === id);

        if (index !== -1) {
          products[index].name = name;
          products[index].price = formattedPrice;
          products[index].category = category;
          products[index].description = description;

          if (imageFile) {
            updateBtn.innerText = "Saving changes...";
            updateBtn.disabled = true;
            compressImageFile(imageFile, function (compressedBase64) {
              products[index].image = compressedBase64;
              try {
                localStorage.setItem("products", JSON.stringify(products));
                syncItemToFirestore("products", products[index], "update");
                document.getElementById("edit-product-form").style.display =
                  "none";
                loadAdminProducts();
                alert("Modifications saved successfully!");
              } catch (err) {
                console.error(err);
                alert("Error! Storage capacity limit hit.");
              } finally {
                updateBtn.innerText = "Save edits";
                updateBtn.disabled = false;
              }
            });
          } else {
            try {
              localStorage.setItem("products", JSON.stringify(products));
              syncItemToFirestore("products", products[index], "update");
              document.getElementById("edit-product-form").style.display =
                "none";
              loadAdminProducts();
              alert("Modifications saved successfully!");
            } catch (err) {
              console.error(err);
              alert("Error! Storage capacity limit hit.");
            }
          }
        }
      });
    }
    window.editEventsAttached = true;
  }

  let products = JSON.parse(localStorage.getItem("products")) || [];

  container.innerHTML = "";

  if (products.length === 0) {
    container.innerHTML =
      '<div style="text-align:center; padding: 3rem; color:var(--text-muted); grid-column: 1 / -1;">No products found inside directory.</div>';
    return;
  }

  products.forEach((product) => {
    const card = document.createElement("div");
    card.className = "order-card";
    card.innerHTML = `
            <div style="display:flex; gap: 1rem; align-items: center; margin-bottom: 1rem;">
                <img src="${product.image}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
                <div>
                    <h4 style="color: var(--primary); margin-bottom: 0.25rem;">${product.name}</h4>
                    <div style="color: var(--text-main); font-weight: 600;">${product.price}</div>
                    <div style="color: var(--text-muted); font-size: 0.85rem; margin-top:0.25rem;">Category: ${getCategoryName(product.category)}</div>
                </div>
            </div>
            <div class="order-actions" style="margin-top: auto;">
                <button class="btn btn-accept edit-product-btn" data-id="${product.id}" style="background: var(--primary);">Edit</button>
                <button class="btn btn-reject delete-product-btn" data-id="${product.id}">Delete</button>
            </div>
        `;
    container.appendChild(card);
  });

  const editBtns = container.querySelectorAll(".edit-product-btn");
  editBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = parseInt(e.currentTarget.getAttribute("data-id"));
      if (typeof window.editProduct === "function") window.editProduct(id);
    });
  });

  const deleteBtns = container.querySelectorAll(".delete-product-btn");
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = parseInt(e.currentTarget.getAttribute("data-id"));
      if (typeof window.deleteProduct === "function") window.deleteProduct(id);
    });
  });
}

function getCategoryName(id) {
  if (id === "all") return "All";
  let categories = JSON.parse(localStorage.getItem("categories")) || [];
  const cat = categories.find((c) => c.id === id);
  return cat ? cat.name : id;
}

window.deleteProduct = function (id) {
  let products = JSON.parse(localStorage.getItem("products")) || [];

  const productToDelete = products.find((p) => p.id === id);
  products = products.filter((p) => p.id !== id);
  localStorage.setItem("products", JSON.stringify(products));
  if (productToDelete) {
    syncItemToFirestore("products", productToDelete, "delete");
  }

  loadAdminProducts();
};

window.editProduct = function (id) {
  let products = JSON.parse(localStorage.getItem("products")) || [];

  const product = products.find((p) => p.id === id);
  if (!product) return;

  document.getElementById("edit-product-id").value = product.id;
  document.getElementById("edit-product-name").value = product.name;
  const priceNum = product.price.replace(/[^\d]/g, "");
  document.getElementById("edit-product-price").value = priceNum;
  document.getElementById("edit-product-category").value = product.category;
  document.getElementById("edit-product-image").value = "";
  document.getElementById("edit-product-desc").value = product.description || "";

  document.getElementById("edit-product-form").style.display = "block";
  document
    .getElementById("edit-product-form")
    .scrollIntoView({ behavior: "smooth", block: "center" });
};

// ------------------------------------
// Banner Management Module
// ------------------------------------

function compressImageFile(file, callback) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      try {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        const MAX_WIDTH = 1000;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        callback(canvas.toDataURL("image/jpeg", 0.6));
      } catch (err) {
        console.error("Compression error:", err);
        callback(e.target.result); // fallback to original state
      }
    };
    img.onerror = function () {
      callback(e.target.result);
    };
    img.src = e.target.result;
  };
  reader.onerror = function () {
    alert("Failed to read selected media file image frame.");
    callback(null);
  };
  reader.readAsDataURL(file);
}

function initBannersTab() {
  loadAdminBanners();

  const addBannerBtn = document.getElementById("add-banner-btn");
  const formContainer = document.getElementById("add-banner-form");
  const saveBtn = document.getElementById("save-banner-btn");

  if (addBannerBtn) {
    addBannerBtn.addEventListener("click", () => {
      if (formContainer.style.display === "none") {
        formContainer.style.display = "block";
        addBannerBtn.innerText = "Cancel";
        addBannerBtn.style.background = "#ef4444";
      } else {
        formContainer.style.display = "none";
        addBannerBtn.innerText = "Add New Banner";
        addBannerBtn.style.background = "#10b981";
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const imageInput = document.getElementById("new-banner-image");
      const imageFile = imageInput.files[0];

      if (!imageFile) {
        alert("Please specify a display image to set as banner element!");
        return;
      }

      saveBtn.innerText = "Saving array slot...";
      saveBtn.disabled = true;

      compressImageFile(imageFile, function (compressedBase64) {
        if (!compressedBase64) {
          saveBtn.innerText = "Save Banner";
          saveBtn.disabled = false;
          return;
        }
        try {
          let banners = [];
          const saved = localStorage.getItem("banners");
          if (saved) {
            banners = JSON.parse(saved);
          } else {
            banners = [];
          }

          banners.push(compressedBase64);
          localStorage.setItem("banners", JSON.stringify(banners));

          if (window.db && window.firestore) {
            window.firestore
              .setDoc(window.firestore.doc(window.db, "meta", "banners"), {
                data: banners,
              })
              .then(() => updateAdminCacheVersion())
              .catch((e) => console.error("Error saving banners:", e));
          }

          document.getElementById("new-banner-image").value = "";
          formContainer.style.display = "none";
          addBannerBtn.innerText = "Add New Banner";
          addBannerBtn.style.background = "#10b981";

          alert("Banner registered live successfully!");
          loadAdminBanners();
        } catch (error) {
          console.error(error);
          alert(
            "Write block failed! Storage map capacity full. Try clearing old layout records or item slots.",
          );
        } finally {
          saveBtn.innerText = "Save Banner";
          saveBtn.disabled = false;
        }
      });
    });
  }
}

function loadAdminBanners() {
  const container = document.getElementById("admin-banners-container");
  if (!container) return;

  let banners = [];
  const saved = localStorage.getItem("banners");
  if (saved) {
    try {
      banners = JSON.parse(saved);
    } catch (e) {
      banners = [];
    }
  } else {
    banners = [];
  }

  container.innerHTML = "";

  if (banners.length === 0) {
    container.innerHTML =
      '<div style="text-align:center; padding: 3rem; color:var(--text-muted);">No layout banners active inside storage.</div>';
    return;
  }

  banners.forEach((bannerUrl, index) => {
    const card = document.createElement("div");
    card.className = "order-card";
    card.style.display = "flex";
    card.style.flexDirection = "row";
    card.style.alignItems = "center";
    card.style.justifyContent = "space-between";

    card.innerHTML = `
            <img src="${bannerUrl}" style="height: 100px; width: auto; max-width: 70%; object-fit: cover; border-radius: 8px;">
            <div class="order-actions" style="margin: 0; min-width: 100px;">
                <button class="btn btn-reject delete-banner-btn" data-index="${index}">Delete</button>
            </div>
        `;
    container.appendChild(card);
  });

  const deleteBtns = container.querySelectorAll(".delete-banner-btn");
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = parseInt(e.currentTarget.getAttribute("data-index"));
      if (typeof window.deleteBanner === "function") {
        window.deleteBanner(index);
      } else {
        alert("Fatal Error: Matrix element deletion handler reference missing!");
      }
    });
  });
}

window.deleteBanner = function (index) {
  try {
    let banners = [];
    const saved = localStorage.getItem("banners");
    if (saved) {
      try {
        banners = JSON.parse(saved);
      } catch (e) {
        banners = [];
      }
    } else {
      banners = [];
    }

    if (index >= 0 && index < banners.length) {
      banners.splice(index, 1);
      try {
        localStorage.setItem("banners", JSON.stringify(banners));
        if (window.db && window.firestore) {
          window.firestore
            .setDoc(window.firestore.doc(window.db, "meta", "banners"), {
              data: banners,
            })
            .then(() => updateAdminCacheVersion())
            .catch((e) => console.error("Error saving banners:", e));
        }
      } catch (e) {
        console.error(e);
        alert("Write operation failed! Local state full. Reference log: " + e.message);
        return;
      }
    }

    loadAdminBanners();
  } catch (error) {
    alert("Process logic crashed during deletion: " + error.message);
    console.error(error);
  }
};

// Category Management Functions
function initCategoriesTab() {
  const addCategoryBtn = document.getElementById("add-category-btn");
  const addCategoryForm = document.getElementById("add-category-form");
  const saveCategoryBtn = document.getElementById("save-category-btn");

  if (addCategoryBtn && addCategoryForm) {
    addCategoryBtn.addEventListener("click", () => {
      const isVisible = addCategoryForm.style.display === "block";
      addCategoryForm.style.display = isVisible ? "none" : "block";
      addCategoryBtn.innerText = isVisible
        ? "Add new category"
        : "Cancel Action";
      if (!isVisible) {
        document.getElementById("edit-category-form").style.display = "none";
      }
    });
  }

  if (saveCategoryBtn) {
    saveCategoryBtn.addEventListener("click", () => {
      const name = document.getElementById("new-category-name").value.trim();
      const imageFile = document.getElementById("new-category-image").files[0];

      if (!name) {
        alert("Please supply a recognizable label name string for the Category.");
        return;
      }

      const id = "cat_" + Date.now();

      saveCategoryBtn.innerText = "Saving category map...";
      saveCategoryBtn.disabled = true;

      const handleSave = (imgUrl) => {
        let categories = JSON.parse(localStorage.getItem("categories")) || [];

        const newCat = { id, name, image: imgUrl };
        categories.push(newCat);
        try {
          localStorage.setItem("categories", JSON.stringify(categories));
          syncItemToFirestore("categories", newCat, "add");

          document.getElementById("new-category-name").value = "";
          document.getElementById("new-category-image").value = "";
          addCategoryForm.style.display = "none";
          addCategoryBtn.innerText = "Add new category";

          loadAdminCategories();
        } catch (e) {
          alert("Storage limit ceiling hit! Please remove alternative elements before adding.");
        }
        saveCategoryBtn.innerText = "Save category";
        saveCategoryBtn.disabled = false;
      };

      if (imageFile) {
        compressImageFile(imageFile, handleSave);
      } else {
        handleSave("https://cdn-icons-png.flaticon.com/512/149/149852.png"); // Fallback placeholder vector graphic image
      }
    });
  }

  const cancelEditBtn = document.getElementById("cancel-category-edit-btn");
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", () => {
      document.getElementById("edit-category-form").style.display = "none";
    });
  }

  const updateBtn = document.getElementById("update-category-btn");
  if (updateBtn) {
    updateBtn.addEventListener("click", () => {
      const originalId = document.getElementById(
        "edit-category-original-id",
      ).value;
      const name = document.getElementById("edit-category-name").value.trim();
      const imageFile = document.getElementById("edit-category-image").files[0];

      if (!name) {
        alert("Category label key missing context text description.");
        return;
      }

      let categories = JSON.parse(localStorage.getItem("categories")) || [];

      const catIndex = categories.findIndex((c) => c.id === originalId);
      if (catIndex === -1) return;

      updateBtn.innerText = "Updating collection index data...";
      updateBtn.disabled = true;

      const handleUpdate = (imgUrl) => {
        categories[catIndex].name = name;
        if (imgUrl) {
          categories[catIndex].image = imgUrl;
        }

        try {
          localStorage.setItem("categories", JSON.stringify(categories));
          syncItemToFirestore("categories", categories[catIndex], "update");
          document.getElementById("edit-category-form").style.display = "none";
          loadAdminCategories();
        } catch (e) {
          alert("Critical error encountered writing map context data onto device.");
        }
        updateBtn.innerText = "Save edits";
        updateBtn.disabled = false;
      };

      if (imageFile) {
        compressImageFile(imageFile, handleUpdate);
      } else {
        handleUpdate(null);
      }
    });
  }

  loadAdminCategories();
}

function loadAdminCategories() {
  if (typeof populateCategorySelects === "function") populateCategorySelects();

  const container = document.getElementById("admin-categories-container");
  if (!container) return;

  let categories = JSON.parse(localStorage.getItem("categories")) || [];

  container.innerHTML = "";

  if (categories.length === 0) {
    container.innerHTML =
      '<div style="grid-column: 1 / -1; text-align: center; padding: 2rem;">No active collection records found inside memory.</div>';
    return;
  }

  categories.forEach((cat) => {
    const card = document.createElement("div");
    card.className = "order-card";
    card.style.display = "flex";
    card.style.flexDirection = "column";

    card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                <img src="${cat.image}" style="width: 50px; height: 50px; object-fit: contain; background: #f8f9fa; border-radius: 8px; padding: 5px;">
                <div>
                    <h3 style="margin-bottom: 0.25rem;">${cat.name}</h3>
                    <span style="color: var(--text-muted); font-size: 0.9rem;">ID: ${cat.id}</span>
                </div>
            </div>
            <div class="order-actions" style="margin-top: auto;">
                <button class="btn btn-accept edit-category-btn" data-id="${cat.id}" style="background: var(--primary);">Edit</button>
                <button class="btn btn-reject delete-category-btn" data-id="${cat.id}">Delete</button>
            </div>
        `;
    container.appendChild(card);
  });

  const editBtns = container.querySelectorAll(".edit-category-btn");
  editBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      if (typeof window.editCategory === "function") window.editCategory(id);
    });
  });

  const deleteBtns = container.querySelectorAll(".delete-category-btn");
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      if (typeof window.deleteCategory === "function")
        window.deleteCategory(id);
    });
  });
}

window.editCategory = function (id) {
  let categories = JSON.parse(localStorage.getItem("categories")) || [];
  
  const cat = categories.find((c) => c.id === id);
  if (!cat) return;

  document.getElementById("edit-category-original-id").value = cat.id;
  document.getElementById("edit-category-name").value = cat.name;
  document.getElementById("edit-category-image").value = "";

  document.getElementById("add-category-form").style.display = "none";
  document.getElementById("add-category-btn").innerText = "Add new category";

  const editForm = document.getElementById("edit-category-form");
  editForm.style.display = "block";
  editForm.scrollIntoView({ behavior: "smooth" });
};

window.deleteCategory = function (id) {
  let categories = JSON.parse(localStorage.getItem("categories")) || [];

  const categoryToDelete = categories.find((c) => c.id === id);
  categories = categories.filter((c) => c.id !== id);

  try {
    localStorage.setItem("categories", JSON.stringify(categories));
    if (categoryToDelete) {
      syncItemToFirestore("categories", categoryToDelete, "delete");
    }
    loadAdminCategories();
  } catch (e) {
    alert("Exception error occurred running entity array slice logic!");
  }
};

function initSettingsTab() {
  const deliveryCostInput = document.getElementById("delivery-cost-input");
  const saveDeliveryCostBtn = document.getElementById("save-delivery-cost-btn");

  if (deliveryCostInput) {
    deliveryCostInput.value = localStorage.getItem("deliveryCost") || "3000";
  }
  if (saveDeliveryCostBtn) {
    saveDeliveryCostBtn.addEventListener("click", () => {
      const cost = deliveryCostInput.value;
      localStorage.setItem("deliveryCost", cost);
      alert("Shipping cost settings modified successfully!");
    });
  }
}
