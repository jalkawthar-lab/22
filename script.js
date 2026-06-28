document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initSidebar();
  loadOrders();
  loadAcceptedOrders();
  initProductsTab();
  initCategoriesTab();
  initBannersTab();
  initSettingsTab();

  window.addEventListener("firebaseReady", () => {
    listenForOrders();
    syncAllDataFromFirestore(); 
  });
});

async function updateAdminCacheVersion() {
  if (window.db && window.firestore) {
    try {
      await window.firestore.setDoc(
        window.firestore.doc(window.db, "meta", "version"),
        { updatedAt: window.firestore.serverTimestamp() },
      );
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
          await window.firestore.deleteDoc(window.firestore.doc(window.db, collectionName, itemData.firestoreId));
        } else {
          const querySnap = await window.firestore.getDocs(window.firestore.collection(window.db, collectionName));
          querySnap.forEach(async (docSnap) => {
            if (docSnap.data().id === itemData.id) await window.firestore.deleteDoc(docSnap.ref);
          });
        }
      } else if (action === "add") {
        await window.firestore.addDoc(window.firestore.collection(window.db, collectionName), itemData);
      } else if (action === "update") {
        if (itemData.firestoreId) {
          await window.firestore.updateDoc(window.firestore.doc(window.db, collectionName, itemData.firestoreId), itemData);
        } else {
          const querySnap = await window.firestore.getDocs(window.firestore.collection(window.db, collectionName));
          querySnap.forEach(async (docSnap) => {
            if (docSnap.data().id === itemData.id) await window.firestore.updateDoc(docSnap.ref, itemData);
          });
        }
      }
      await updateAdminCacheVersion();
    } catch (e) {
      console.error(`خطأ في السيرفر أثناء التعامل مع ${collectionName}:`, e);
      alert("حدث خطأ أثناء الاتصال بقاعدة البيانات. تأكد من إعدادات الصلاحيات.");
    }
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
        const pendingOrders = firestoreOrders.filter((o) => o.status === "pending");
        const acceptedOrders = firestoreOrders.filter((o) => o.status === "accepted");
        localStorage.setItem("pendingOrders", JSON.stringify(pendingOrders));
        localStorage.setItem("acceptedOrders", JSON.stringify(acceptedOrders));
        loadOrders();
        if (typeof loadAcceptedOrders === "function") loadAcceptedOrders();
      },
    );
  }
}

async function syncAllDataFromFirestore() {
  if (window.db && window.firestore) {
    try {
      const productsSnap = await window.firestore.getDocs(window.firestore.collection(window.db, "products"));
      let fetchedProducts = [];
      productsSnap.forEach((doc) => fetchedProducts.push({ firestoreId: doc.id, ...doc.data() }));
      localStorage.setItem("products", JSON.stringify(fetchedProducts));

      const categoriesSnap = await window.firestore.getDocs(window.firestore.collection(window.db, "categories"));
      let fetchedCategories = [];
      categoriesSnap.forEach((doc) => fetchedCategories.push({ firestoreId: doc.id, ...doc.data() }));
      localStorage.setItem("categories", JSON.stringify(fetchedCategories));

      if (window.firestore.getDoc) {
        const bannersDoc = await window.firestore.getDoc(window.firestore.doc(window.db, "meta", "banners"));
        if (bannersDoc.exists && bannersDoc.exists()) {
          localStorage.setItem("banners", JSON.stringify(bannersDoc.data().data || []));
        }
      }

      populateCategorySelects();
      loadAdminProducts();
      loadAdminCategories();
      loadAdminBanners();
    } catch (e) {
      console.error("خطأ في المزامنة:", e);
    }
  }
}

function initTabs() {
  const tabs = document.querySelectorAll(".sidebar-menu li");
  const contents = document.querySelectorAll(".tab-content");
  const headerTitle = document.querySelector(".top-header h3");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      contents.forEach((c) => c.classList.remove("active"));

      tab.classList.add("active");
      const targetId = tab.dataset.tab + "-tab";
      document.getElementById(targetId).classList.add("active");

      if (headerTitle) headerTitle.innerText = tab.innerText;

      const sidebar = document.getElementById("sidebar");
      if (window.innerWidth <= 768 && sidebar) sidebar.classList.remove("open");
    });
  });
}

function initSidebar() {
  const toggleBtn = document.getElementById("toggle-sidebar");
  const sidebar = document.getElementById("sidebar");
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => sidebar.classList.toggle("open"));
  }
}

function loadOrders() {
  const container = document.getElementById("orders-container");
  if (!container) return;

  let pendingOrders = JSON.parse(localStorage.getItem("pendingOrders") || "[]");

  if (pendingOrders.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding: 3rem; color:var(--text-muted); grid-column: 1 / -1; font-size: 1.1rem; font-weight:700;">لا توجد طلبات جديدة قيد الانتظار حالياً...</div>';
    return;
  }

  pendingOrders.sort((a, b) => new Date(b.createdAt?.toDate?.() || b.date) - new Date(a.createdAt?.toDate?.() || a.date));
  container.innerHTML = "";

  pendingOrders.forEach((order) => {
    // FIX: Pulling correct values directly from the database entry rather than local client cache
    const cName = order.customerName || "غير متوفر";
    const cAddress = order.customerAddress || "غير متوفر";
    const cPhone = order.customerPhone || "غير متوفر";
    const cProvince = order.customerProvince || "غير متوفر";
    
    let subtotal = 0;
    let itemsHtml = "";
    
    (order.items || []).forEach((item) => {
      const priceNum = typeof item.price === "string" ? parseInt(item.price.replace(/[^\d]/g, "")) : parseInt(item.price);
      subtotal += priceNum * item.quantity;
      itemsHtml += `
            <div class="order-item">
                <span>${item.name} (${item.quantity}x)</span>
                <span>${(priceNum * item.quantity).toLocaleString("en-US")} د.ع</span>
            </div>`;
    });
    
    const shippingFee = order.shippingCost || 0;
    const total = subtotal + shippingFee;

    const card = document.createElement("div");
    card.className = "order-card";
    card.innerHTML = `
            <div class="order-header">
                <span class="order-id">طلب رقم ${order.id}</span>
            </div>
            <div class="order-customer">
                <div><strong>الاسم:</strong> ${cName}</div>
                <div><strong>رقم الهاتف:</strong> <span dir="ltr">${cPhone}</span></div>
                <div><strong>المحافظة:</strong> ${cProvince}</div>
                <div><strong>العنوان:</strong> ${cAddress}</div>
            </div>
            <div class="order-items">
                ${itemsHtml}
            </div>
            <div class="order-total">
                المجموع الكلي مع التوصيل: ${total.toLocaleString("en-US")} د.ع
            </div>
            <div class="order-actions">
                <button class="btn btn-accept process-order-btn" data-id="${order.id}" data-action="accept">تأكيد وقبول الطلب</button>
                <button class="btn btn-reject process-order-btn" data-id="${order.id}" data-action="reject">رفض الطلب</button>
            </div>
        `;
    container.appendChild(card);
  });

  const processBtns = container.querySelectorAll(".process-order-btn");
  processBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      const action = e.currentTarget.getAttribute("data-action");
      if (typeof window.processOrder === "function") window.processOrder(id, action);
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
          await window.firestore.updateDoc(window.firestore.doc(window.db, "orders", order.firestoreId), { status: "accepted" });
        } else {
          await window.firestore.deleteDoc(window.firestore.doc(window.db, "orders", order.firestoreId));
        }
      } catch (e) {
        console.error("Firestore update error: ", e);
      }
    }
  }
};

function loadAcceptedOrders() {
  const container = document.getElementById("accepted-orders-container");
  if (!container) return;

  let acceptedOrders = JSON.parse(localStorage.getItem("acceptedOrders") || "[]");

  if (acceptedOrders.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding: 3rem; color:var(--text-muted); grid-column: 1 / -1; font-size: 1.1rem; font-weight:700;">لا توجد طلبات منجزة في السجل حالياً...</div>';
    return;
  }

  acceptedOrders.sort((a, b) => new Date(b.createdAt?.toDate?.() || b.date) - new Date(a.createdAt?.toDate?.() || a.date));
  container.innerHTML = "";

  acceptedOrders.forEach((order) => {
    const cName = order.customerName || "غير متوفر";
    const cAddress = order.customerAddress || "غير متوفر";
    const cPhone = order.customerPhone || "غير متوفر";
    const cProvince = order.customerProvince || "غير متوفر";

    let subtotal = 0;
    let itemsHtml = "";
    (order.items || []).forEach((item) => {
      const priceNum = typeof item.price === "string" ? parseInt(item.price.replace(/[^\d]/g, "")) : parseInt(item.price);
      subtotal += priceNum * item.quantity;
      itemsHtml += `
            <div class="order-item">
                <span>${item.name} (${item.quantity}x)</span>
                <span>${(priceNum * item.quantity).toLocaleString("en-US")} د.ع</span>
            </div>`;
    });
    
    const shippingFee = order.shippingCost || 0;
    const total = subtotal + shippingFee;

    const card = document.createElement("div");
    card.className = "order-card";
    card.style.border = "1px solid #10b981";
    card.innerHTML = `
            <div class="order-header">
                <span class="order-id">طلب رقم ${order.id}</span>
            </div>
            <div class="order-customer">
                <div><strong>الاسم:</strong> ${cName}</div>
                <div><strong>رقم الهاتف:</strong> <span dir="ltr">${cPhone}</span></div>
                <div><strong>المحافظة:</strong> ${cProvince}</div>
                <div><strong>العنوان:</strong> ${cAddress}</div>
            </div>
            <div class="order-items">
                ${itemsHtml}
            </div>
            <div class="order-total" style="color: #10b981;">
                المبلغ المقبوض: ${total.toLocaleString("en-US")} د.ع
            </div>
            <div class="order-actions">
                <button class="btn btn-reject delete-accepted-order-btn" data-id="${order.id}">حذف نهائي من السجل</button>
            </div>
        `;
    container.appendChild(card);
  });

  const deleteBtns = container.querySelectorAll(".delete-accepted-order-btn");
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      if (typeof window.deleteAcceptedOrder === "function") window.deleteAcceptedOrder(id);
    });
  });
}

window.deleteAcceptedOrder = async function (id) {
  let acceptedOrders = JSON.parse(localStorage.getItem("acceptedOrders") || "[]");
  const orderIndex = acceptedOrders.findIndex((o) => o.id === id);
  if (orderIndex !== -1) {
    const order = acceptedOrders[orderIndex];
    if (window.db && window.firestore && order.firestoreId) {
      try {
        await window.firestore.deleteDoc(window.firestore.doc(window.db, "orders", order.firestoreId));
      } catch (e) {
        console.error("Firestore delete error", e);
      }
    }
  }
};

// ===================================
// Product Management
// ===================================
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
        addProductBtn.innerText = "إلغاء العملية";
        addProductBtn.style.background = "#ef4444";
      } else {
        formContainer.style.display = "none";
        addProductBtn.innerText = "إضافة منتج جديد";
        addProductBtn.style.background = "var(--primary)";
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
        alert("يرجى ملء جميع الحقول ورفع صورة للمنتج!");
        return;
      }

      saveBtn.innerText = "جاري الحفظ والرفع...";
      saveBtn.disabled = true;

      compressImageFile(imageFile, function (compressedBase64) {
        let products = JSON.parse(localStorage.getItem("products")) || [];
        const newId = products.length > 0 ? Math.max(...products.map((p) => p.id)) + 1 : 1;
        const formattedPrice = parseInt(price).toLocaleString("en-US") + " د.ع";

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
        addProductBtn.innerText = "إضافة منتج جديد";
        addProductBtn.style.background = "var(--primary)";

        alert("تم حفظ المنتج بنجاح!");
        loadAdminProducts();
        
        saveBtn.innerText = "حفظ المنتج";
        saveBtn.disabled = false;
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

    if (cancelBtn) cancelBtn.addEventListener("click", () => document.getElementById("edit-product-form").style.display = "none");

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
          alert("يرجى ملء جميع الحقول المطلوبة!");
          return;
        }

        let products = JSON.parse(localStorage.getItem("products")) || [];
        const formattedPrice = parseInt(price).toLocaleString("en-US") + " د.ع";
        const index = products.findIndex((p) => p.id === id);

        if (index !== -1) {
          products[index].name = name;
          products[index].price = formattedPrice;
          products[index].category = category;
          products[index].description = description;

          const finishUpdate = () => {
            localStorage.setItem("products", JSON.stringify(products));
            syncItemToFirestore("products", products[index], "update");
            document.getElementById("edit-product-form").style.display = "none";
            loadAdminProducts();
            alert("تم حفظ التعديلات بنجاح!");
            updateBtn.innerText = "حفظ التعديلات";
            updateBtn.disabled = false;
          };

          if (imageFile) {
            updateBtn.innerText = "جاري تحديث الصورة...";
            updateBtn.disabled = true;
            compressImageFile(imageFile, function (compressedBase64) {
              products[index].image = compressedBase64;
              finishUpdate();
            });
          } else {
            finishUpdate();
          }
        }
      });
    }
    window.editEventsAttached = true;
  }

  let products = JSON.parse(localStorage.getItem("products")) || [];
  container.innerHTML = "";

  if (products.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding: 3rem; color:var(--text-muted); grid-column: 1 / -1; font-weight: 700;">لا توجد منتجات مسجلة في قاعدة البيانات حالياً.</div>';
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
                    <div style="color: var(--text-main); font-weight: 800;">${product.price}</div>
                    <div style="color: var(--text-muted); font-size: 0.85rem; margin-top:0.25rem;">الفئة: ${getCategoryName(product.category)}</div>
                </div>
            </div>
            <div class="order-actions" style="margin-top: auto;">
                <button class="btn btn-accept edit-product-btn" data-id="${product.id}">تعديل البيانات</button>
                <button class="btn btn-reject delete-product-btn" data-id="${product.id}">حذف نهائي</button>
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
  if (id === "all") return "الكل";
  let categories = JSON.parse(localStorage.getItem("categories")) || [];
  const cat = categories.find((c) => c.id === id);
  return cat ? cat.name : id;
}

window.deleteProduct = function (id) {
  let products = JSON.parse(localStorage.getItem("products")) || [];
  const productToDelete = products.find((p) => p.id === id);
  products = products.filter((p) => p.id !== id);
  localStorage.setItem("products", JSON.stringify(products));
  if (productToDelete) syncItemToFirestore("products", productToDelete, "delete");
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
  document.getElementById("edit-product-form").scrollIntoView({ behavior: "smooth", block: "center" });
};

// ===================================
// Banners Management
// ===================================
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
        callback(e.target.result); 
      }
    };
    img.onerror = function () { callback(e.target.result); };
    img.src = e.target.result;
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
        addBannerBtn.innerText = "إلغاء العملية";
        addBannerBtn.style.background = "#ef4444";
      } else {
        formContainer.style.display = "none";
        addBannerBtn.innerText = "إضافة لافتة جديدة";
        addBannerBtn.style.background = "var(--primary)";
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const imageInput = document.getElementById("new-banner-image");
      const imageFile = imageInput.files[0];
      if (!imageFile) {
        alert("يرجى إرفاق صورة أولاً!"); return;
      }

      saveBtn.innerText = "جاري الحفظ...";
      saveBtn.disabled = true;

      compressImageFile(imageFile, function (compressedBase64) {
        if (!compressedBase64) return;
        let banners = JSON.parse(localStorage.getItem("banners") || "[]");
        banners.push(compressedBase64);
        localStorage.setItem("banners", JSON.stringify(banners));

        if (window.db && window.firestore) {
          window.firestore.setDoc(window.firestore.doc(window.db, "meta", "banners"), { data: banners })
            .then(() => updateAdminCacheVersion());
        }

        document.getElementById("new-banner-image").value = "";
        formContainer.style.display = "none";
        addBannerBtn.innerText = "إضافة لافتة جديدة";
        addBannerBtn.style.background = "var(--primary)";
        alert("تم رفع اللافتة بنجاح!");
        loadAdminBanners();
        saveBtn.innerText = "حفظ اللافتة";
        saveBtn.disabled = false;
      });
    });
  }
}

function loadAdminBanners() {
  const container = document.getElementById("admin-banners-container");
  if (!container) return;

  let banners = JSON.parse(localStorage.getItem("banners") || "[]");
  container.innerHTML = "";

  if (banners.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding: 3rem; color:var(--text-muted); font-weight: 700;">لا توجد لافتات إعلانية فعالة.</div>';
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
                <button class="btn btn-reject delete-banner-btn" data-index="${index}">حذف</button>
            </div>
        `;
    container.appendChild(card);
  });

  const deleteBtns = container.querySelectorAll(".delete-banner-btn");
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = parseInt(e.currentTarget.getAttribute("data-index"));
      if (typeof window.deleteBanner === "function") window.deleteBanner(index);
    });
  });
}

window.deleteBanner = function (index) {
  let banners = JSON.parse(localStorage.getItem("banners") || "[]");
  if (index >= 0 && index < banners.length) {
    banners.splice(index, 1);
    localStorage.setItem("banners", JSON.stringify(banners));
    if (window.db && window.firestore) {
      window.firestore.setDoc(window.firestore.doc(window.db, "meta", "banners"), { data: banners })
        .then(() => updateAdminCacheVersion());
    }
  }
  loadAdminBanners();
};

// ===================================
// Categories Management
// ===================================
function initCategoriesTab() {
  const addCategoryBtn = document.getElementById("add-category-btn");
  const addCategoryForm = document.getElementById("add-category-form");
  const saveCategoryBtn = document.getElementById("save-category-btn");

  if (addCategoryBtn && addCategoryForm) {
    addCategoryBtn.addEventListener("click", () => {
      const isVisible = addCategoryForm.style.display === "block";
      addCategoryForm.style.display = isVisible ? "none" : "block";
      addCategoryBtn.innerText = isVisible ? "إضافة فئة جديدة" : "إلغاء العملية";
      addCategoryBtn.style.background = isVisible ? "var(--primary)" : "#ef4444";
      if (!isVisible) document.getElementById("edit-category-form").style.display = "none";
    });
  }

  if (saveCategoryBtn) {
    saveCategoryBtn.addEventListener("click", () => {
      const name = document.getElementById("new-category-name").value.trim();
      const imageFile = document.getElementById("new-category-image").files[0];

      if (!name) {
        alert("يرجى إدخال اسم للفئة."); return;
      }

      const id = "cat_" + Date.now();
      saveCategoryBtn.innerText = "جاري الحفظ...";
      saveCategoryBtn.disabled = true;

      const handleSave = (imgUrl) => {
        let categories = JSON.parse(localStorage.getItem("categories")) || [];
        const newCat = { id, name, image: imgUrl };
        categories.push(newCat);
        localStorage.setItem("categories", JSON.stringify(categories));
        syncItemToFirestore("categories", newCat, "add");

        document.getElementById("new-category-name").value = "";
        document.getElementById("new-category-image").value = "";
        addCategoryForm.style.display = "none";
        addCategoryBtn.innerText = "إضافة فئة جديدة";
        addCategoryBtn.style.background = "var(--primary)";

        loadAdminCategories();
        saveCategoryBtn.innerText = "حفظ الفئة";
        saveCategoryBtn.disabled = false;
      };

      if (imageFile) compressImageFile(imageFile, handleSave);
      else handleSave("https://cdn-icons-png.flaticon.com/512/149/149852.png");
    });
  }

  const cancelEditBtn = document.getElementById("cancel-category-edit-btn");
  if (cancelEditBtn) cancelEditBtn.addEventListener("click", () => document.getElementById("edit-category-form").style.display = "none");

  const updateBtn = document.getElementById("update-category-btn");
  if (updateBtn) {
    updateBtn.addEventListener("click", () => {
      const originalId = document.getElementById("edit-category-original-id").value;
      const name = document.getElementById("edit-category-name").value.trim();
      const imageFile = document.getElementById("edit-category-image").files[0];

      if (!name) { alert("يرجى كتابة اسم الفئة!"); return; }

      let categories = JSON.parse(localStorage.getItem("categories")) || [];
      const catIndex = categories.findIndex((c) => c.id === originalId);
      if (catIndex === -1) return;

      updateBtn.innerText = "جاري التحديث...";
      updateBtn.disabled = true;

      const handleUpdate = (imgUrl) => {
        categories[catIndex].name = name;
        if (imgUrl) categories[catIndex].image = imgUrl;
        
        localStorage.setItem("categories", JSON.stringify(categories));
        syncItemToFirestore("categories", categories[catIndex], "update");
        document.getElementById("edit-category-form").style.display = "none";
        loadAdminCategories();
        
        updateBtn.innerText = "حفظ التعديلات";
        updateBtn.disabled = false;
      };

      if (imageFile) compressImageFile(imageFile, handleUpdate);
      else handleUpdate(null);
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
    container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 2rem; font-weight: 700; color: var(--text-muted);">لا توجد فئات حالياً، يرجى إضافة فئة للبدء.</div>';
    return;
  }

  categories.forEach((cat) => {
    const card = document.createElement("div");
    card.className = "order-card";
    card.style.display = "flex";
    card.style.flexDirection = "column";

    card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                <img src="${cat.image}" style="width: 50px; height: 50px; object-fit: contain; background: #ffffff; border-radius: 8px; padding: 5px;">
                <div>
                    <h3 style="margin-bottom: 0.25rem;">${cat.name}</h3>
                    <span style="color: var(--text-muted); font-size: 0.9rem;">المعرف: ${cat.id}</span>
                </div>
            </div>
            <div class="order-actions" style="margin-top: auto;">
                <button class="btn btn-accept edit-category-btn" data-id="${cat.id}">تعديل الفئة</button>
                <button class="btn btn-reject delete-category-btn" data-id="${cat.id}">حذف</button>
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
      if (typeof window.deleteCategory === "function") window.deleteCategory(id);
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
  document.getElementById("add-category-btn").innerText = "إضافة فئة جديدة";
  document.getElementById("add-category-btn").style.background = "var(--primary)";

  const editForm = document.getElementById("edit-category-form");
  editForm.style.display = "block";
  editForm.scrollIntoView({ behavior: "smooth" });
};

window.deleteCategory = function (id) {
  let categories = JSON.parse(localStorage.getItem("categories")) || [];
  const categoryToDelete = categories.find((c) => c.id === id);
  categories = categories.filter((c) => c.id !== id);

  localStorage.setItem("categories", JSON.stringify(categories));
  if (categoryToDelete) syncItemToFirestore("categories", categoryToDelete, "delete");
  loadAdminCategories();
};

function initSettingsTab() {
  const deliveryCostInput = document.getElementById("delivery-cost-input");
  const saveDeliveryCostBtn = document.getElementById("save-delivery-cost-btn");

  if (deliveryCostInput) deliveryCostInput.value = localStorage.getItem("deliveryCost") || "3000";
  
  if (saveDeliveryCostBtn) {
    saveDeliveryCostBtn.addEventListener("click", () => {
      const cost = deliveryCostInput.value;
      localStorage.setItem("deliveryCost", cost);
      alert("تم تحديث إعدادات تكلفة الشحن بنجاح!");
    });
  }
}
