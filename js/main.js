(() => {
  const CART_KEY = "vintageFoodCart:v1";
  const ORDERS_KEY = "vintageFoodOrders:v1";
  const MENU_URL = "data/menu.json";

  const safeJsonParse = (value, fallback) => {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };

  const loadCart = () => {
    const raw = localStorage.getItem(CART_KEY);
    const cart = safeJsonParse(raw, {});
    return cart && typeof cart === "object" ? cart : {};
  };

  const saveCart = (cart) => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    document.dispatchEvent(new CustomEvent("cart:changed"));
  };

  const addToCart = (id, qty = 1) => {
    const cart = loadCart();
    cart[id] = (cart[id] || 0) + qty;
    if (cart[id] <= 0) delete cart[id];
    saveCart(cart);
  };

  const setQty = (id, qty) => {
    const cart = loadCart();
    if (qty <= 0) delete cart[id];
    else cart[id] = qty;
    saveCart(cart);
  };

  const clearCart = () => saveCart({});

  const cartCount = (cart) =>
    Object.values(cart).reduce((sum, v) => sum + (typeof v === "number" ? v : 0), 0);

  const rub = (value) => new Intl.NumberFormat("ru-RU").format(value);

  const fetchMenu = async () => {
    const res = await fetch(MENU_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Menu fetch failed");
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    const map = new Map(items.map((it) => [it.id, it]));
    return { items, map };
  };

  const CATEGORY_LABELS = {
    burgers: "Бургеры",
    chicken: "Блюда из курицы",
    hot: "Горячие блюда",
    snacks: "Закуски",
    salads: "Салаты",
    desserts: "Десерты"
  };

  const updateCartBadges = () => {
    const cart = loadCart();
    const count = cartCount(cart);
    document.querySelectorAll("[data-cart-count]").forEach((el) => {
      el.textContent = String(count);
      el.hidden = count <= 0;
    });
  };

  const computeTotal = (cart, menuMap) => {
    let total = 0;
    for (const [id, qty] of Object.entries(cart)) {
      const item = menuMap.get(id);
      if (!item) continue;
      total += item.price * qty;
    }
    return total;
  };

  const updateTotals = async () => {
    const totalEl = document.querySelector("[data-cart-total]");
    if (!totalEl) return;
    try {
      const { map } = await fetchMenu();
      const cart = loadCart();
      totalEl.textContent = rub(computeTotal(cart, map));
    } catch {
      totalEl.textContent = "0";
    }
  };

  const renderProducts = async () => {
    const root = document.querySelector("[data-products]");
    if (!root) return;

    try {
      const { items } = await fetchMenu();
      root.innerHTML = "";

      items.forEach((it) => {
        const card = document.createElement("article");
        card.className = "product_card";
        const img = it.image ? String(it.image) : "";
        const desc = it.description ? String(it.description) : "";
        card.innerHTML = `
          ${img ? `<img class="product_image" src="${img}" alt="" loading="lazy">` : ""}
          <h3 class="product_title">${it.title}</h3>
          ${desc ? `<p class="product_desc">${desc}</p>` : ""}
          <div class="product_meta">
            <span>${it.weightG ? `${it.weightG} г` : ""}</span>
            <span class="price">${rub(it.price)} ₽</span>
          </div>
          <div class="product_actions">
            <button class="container_button_header" type="button" data-add="${it.id}">Добавить</button>
            <a class="link_button" href="cart.html">Корзина</a>
          </div>
        `;
        root.appendChild(card);
      });
    } catch {
      root.innerHTML = `<div class="promo_card"><p class="promo_title">Не удалось загрузить меню</p><p class="promo_text">Проверь, что сайт запущен через локальный сервер.</p></div>`;
    }
  };

  const renderCategoryProducts = async () => {
    const roots = document.querySelectorAll("[data-category-products]");
    if (roots.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const cat = params.get("cat");

    try {
      const { items } = await fetchMenu();
      const byCat = new Map();
      items.forEach((it) => {
        const key = it.category || "other";
        if (!byCat.has(key)) byCat.set(key, []);
        byCat.get(key).push(it);
      });

      roots.forEach((root) => {
        const key = root.getAttribute("data-category-products");
        const list = byCat.get(key) || [];
        root.innerHTML = "";

        list.forEach((it) => {
          const card = document.createElement("article");
          card.className = "product_card";
          const img = it.image ? String(it.image) : "";
          const desc = it.description ? String(it.description) : "";
          card.innerHTML = `
            ${img ? `<img class="product_image" src="${img}" alt="" loading="lazy">` : ""}
            <h3 class="product_title">${it.title}</h3>
            ${desc ? `<p class="product_desc">${desc}</p>` : ""}
            <div class="product_meta">
              <span>${it.weightG ? `${it.weightG} г` : ""}</span>
              <span class="price">${rub(it.price)} ₽</span>
            </div>
            <div class="product_actions">
              <button class="container_button_header" type="button" data-add="${it.id}">Добавить</button>
              <a class="link_button" href="cart.html">Корзина</a>
            </div>
          `;
          root.appendChild(card);
        });
      });

      if (cat && CATEGORY_LABELS[cat]) {
        // Если открыли menu.html?cat=...#cat-..., аккуратно проскроллим в секцию.
        const el = document.getElementById(`cat-${cat}`);
        el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      }
    } catch {
      roots.forEach((root) => {
        root.innerHTML = `<div class="promo_card"><p class="promo_title">Не удалось загрузить меню</p><p class="promo_text">Запусти сайт через локальный сервер.</p></div>`;
      });
    }
  };

  const initNavDropdown = () => {
    const wrapper = document.querySelector("[data-nav-dropdown]");
    if (!wrapper) return;

    const btn = wrapper.querySelector("button[aria-controls]");
    const panel = wrapper.querySelector(".nav_dropdown_panel");
    if (!btn || !panel) return;

    const open = () => {
      panel.hidden = false;
      btn.setAttribute("aria-expanded", "true");
    };

    const close = () => {
      panel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    };

    const toggle = () => {
      if (panel.hidden) open();
      else close();
    };

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      toggle();
    });

    document.addEventListener("click", (e) => {
      if (panel.hidden) return;
      if (!wrapper.contains(e.target)) close();
    });

    document.addEventListener("keydown", (e) => {
      if (panel.hidden) return;
      if (e.key === "Escape") {
        close();
        btn.focus();
      }
    });

    wrapper.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" && panel.hidden) {
        open();
        const first = panel.querySelector("a");
        first?.focus?.();
      }
    });

    // закрыть при переходе по пункту
    panel.addEventListener("click", () => close());
  };

  const bindAddToCart = () => {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-add]");
      if (!btn) return;
      addToCart(btn.getAttribute("data-add"), 1);
    });
  };

  const renderCart = async () => {
    const root = document.querySelector("[data-cart]");
    if (!root) return;

    try {
      const { map } = await fetchMenu();
      const cart = loadCart();
      const entries = Object.entries(cart).filter(([_, qty]) => qty > 0);

      if (entries.length === 0) {
        root.innerHTML = `
          <div class="promo_card">
            <p class="promo_title">Пока пусто</p>
            <p class="promo_text">Добавь что‑нибудь из меню — и оно появится здесь.</p>
            <a class="container_button_header" href="menu.html">Перейти в меню</a>
          </div>
        `;
        return;
      }

      root.innerHTML = `<div class="promo_card"><div class="checkout_summary" data-cart-lines></div></div>`;
      const lines = root.querySelector("[data-cart-lines]");

      entries.forEach(([id, qty]) => {
        const item = map.get(id);
        if (!item) return;

        const row = document.createElement("div");
        row.className = "summary_row";
        row.innerHTML = `
          <span><strong>${item.title}</strong> × ${qty}</span>
          <span>
            <button class="icon_button" type="button" data-dec="${id}" aria-label="Уменьшить">−</button>
            <button class="icon_button" type="button" data-inc="${id}" aria-label="Увеличить">+</button>
            <button class="icon_button" type="button" data-del="${id}" aria-label="Удалить">×</button>
          </span>
        `;
        lines.appendChild(row);
      });
    } catch {
      root.innerHTML = `<div class="promo_card"><p class="promo_title">Не удалось загрузить корзину</p><p class="promo_text">Открой сайт через локальный сервер.</p></div>`;
    }
  };

  const bindCartControls = () => {
    const clearBtn = document.querySelector("[data-cart-clear]");
    clearBtn?.addEventListener("click", () => clearCart());

    const cartRoot = document.querySelector("[data-cart]");
    if (!cartRoot) return;
    cartRoot.addEventListener("click", (e) => {
      const inc = e.target.closest("[data-inc]");
      const dec = e.target.closest("[data-dec]");
      const del = e.target.closest("[data-del]");
      if (!(inc || dec || del)) return;

      const id = (inc || dec || del).getAttribute("data-inc") ||
        (inc || dec || del).getAttribute("data-dec") ||
        (inc || dec || del).getAttribute("data-del");

      const cart = loadCart();
      const current = cart[id] || 0;

      if (inc) addToCart(id, 1);
      if (dec) setQty(id, current - 1);
      if (del) setQty(id, 0);
    });
  };

  const renderCheckoutSummary = async () => {
    const root = document.querySelector("[data-checkout-summary]");
    if (!root) return;

    try {
      const { map } = await fetchMenu();
      const cart = loadCart();
      const entries = Object.entries(cart).filter(([_, qty]) => qty > 0);

      if (entries.length === 0) {
        root.innerHTML = `<p class="promo_text">Корзина пуста. <a href="menu.html">Перейти в меню</a></p>`;
        return;
      }

      root.innerHTML = "";
      entries.forEach(([id, qty]) => {
        const item = map.get(id);
        if (!item) return;
        const line = document.createElement("div");
        line.className = "summary_row";
        line.innerHTML = `<span>${item.title} × ${qty}</span><span>${rub(item.price * qty)} ₽</span>`;
        root.appendChild(line);
      });
    } catch {
      root.innerHTML = `<p class="promo_text">Не удалось загрузить состав заказа.</p>`;
    }
  };

  const bindCheckoutForm = () => {
    const form = document.querySelector("[data-checkout-form]");
    if (!form) return;

    const note = document.querySelector("[data-checkout-note]");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const cart = loadCart();
      if (cartCount(cart) === 0) {
        if (note) {
          note.hidden = false;
          note.textContent = "Корзина пуста. Добавь позиции в меню перед оформлением.";
        }
        return;
      }

      if (!form.reportValidity()) return;

      const fd = new FormData(form);
      const orderId =
        (globalThis.crypto?.randomUUID?.() || `order_${Date.now()}_${Math.random().toString(16).slice(2)}`);

      const payload = {
        id: orderId,
        name: String(fd.get("name") || "").trim(),
        phone: String(fd.get("phone") || "").trim(),
        address: String(fd.get("address") || "").trim(),
        comment: String(fd.get("comment") || "").trim(),
        cart,
        status: "created",
        createdAt: new Date().toISOString(),
        timeline: [
          { key: "created", label: "Заказ создан", at: Date.now() },
          { key: "paid", label: "Оплата подтверждена", at: Date.now() + 3000 },
          { key: "cooking", label: "Готовим", at: Date.now() + 8000 },
          { key: "delivering", label: "В пути", at: Date.now() + 15000 },
          { key: "done", label: "Доставлено", at: Date.now() + 25000 }
        ]
      };

      const existing = safeJsonParse(localStorage.getItem(ORDERS_KEY), []);
      const orders = Array.isArray(existing) ? existing : [];
      orders.unshift(payload);
      localStorage.setItem(ORDERS_KEY, JSON.stringify(orders.slice(0, 10)));

      clearCart();

      window.location.href = `order.html?id=${encodeURIComponent(orderId)}`;
    });
  };

  const updateOrderStatus = (order) => {
    const now = Date.now();
    const steps = Array.isArray(order.timeline) ? order.timeline : [];
    let status = order.status || "created";
    for (const s of steps) {
      if (typeof s?.at === "number" && now >= s.at) status = s.key;
    }
    return status;
  };

  const renderOrder = async () => {
    const root = document.querySelector("[data-order]");
    if (!root) return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) {
      root.innerHTML = `<div class="promo_card"><p class="promo_title">Заказ не найден</p><p class="promo_text">Открой страницу из оформления заказа или из истории.</p><a class="container_button_header" href="orders.html">История заказов</a></div>`;
      return;
    }

    const existing = safeJsonParse(localStorage.getItem(ORDERS_KEY), []);
    const orders = Array.isArray(existing) ? existing : [];
    const order = orders.find((o) => o && o.id === id);
    if (!order) {
      root.innerHTML = `<div class="promo_card"><p class="promo_title">Заказ не найден</p><p class="promo_text">Возможно, он был очищен из локальной истории.</p><a class="container_button_header" href="orders.html">История заказов</a></div>`;
      return;
    }

    try {
      const { map } = await fetchMenu();
      const status = updateOrderStatus(order);
      const total = rub(computeTotal(order.cart || {}, map));
      const statusLabel =
        status === "created" ? "Создан" :
        status === "paid" ? "Оплачен" :
        status === "cooking" ? "Готовим" :
        status === "delivering" ? "В пути" :
        status === "done" ? "Доставлено" : status;

      const timeline = Array.isArray(order.timeline) ? order.timeline : [];
      root.innerHTML = `
        <div class="promo_card">
          <p class="promo_title">Заказ № ${order.id}</p>
          <p class="promo_text">Статус: <span class="status_pill status_${status}">${statusLabel}</span></p>
          <p class="promo_text"><strong>Итого:</strong> ${total} ₽</p>
          <div class="checkout_summary">
            ${timeline.map((s) => {
              const done = typeof s.at === "number" && Date.now() >= s.at;
              return `<div class="timeline_row ${done ? "is_done" : ""}">
                <span>${s.label}</span>
                <span class="timeline_time">${new Date(s.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>`;
            }).join("")}
          </div>
          <div class="hero_actions">
            <a class="container_button_header" href="menu.html">Заказать ещё</a>
            <a class="link_button" href="orders.html">История заказов</a>
          </div>
        </div>
      `;
    } catch {
      root.innerHTML = `<div class="promo_card"><p class="promo_title">Не удалось загрузить заказ</p><p class="promo_text">Запусти сайт через локальный сервер.</p></div>`;
    }
  };

  const renderOrdersList = async () => {
    const root = document.querySelector("[data-orders]");
    if (!root) return;

    const existing = safeJsonParse(localStorage.getItem(ORDERS_KEY), []);
    const orders = Array.isArray(existing) ? existing : [];
    if (orders.length === 0) {
      root.innerHTML = `<div class="promo_card"><p class="promo_title">История пуста</p><p class="promo_text">Оформи заказ — и он появится здесь.</p><a class="container_button_header" href="menu.html">Перейти в меню</a></div>`;
      return;
    }

    try {
      const { map } = await fetchMenu();
      root.innerHTML = `<div class="products_grid"></div>`;
      const grid = root.querySelector(".products_grid");

      orders.forEach((o) => {
        const status = updateOrderStatus(o);
        const total = rub(computeTotal(o.cart || {}, map));
        const card = document.createElement("article");
        card.className = "product_card";
        card.innerHTML = `
          <h3 class="product_title">Заказ № ${o.id}</h3>
          <p class="product_desc">Итого: <strong>${total} ₽</strong></p>
          <p class="product_desc">Статус: <span class="status_pill status_${status}">${status}</span></p>
          <div class="product_actions">
            <a class="container_button_header" href="order.html?id=${encodeURIComponent(o.id)}">Открыть</a>
            <button class="link_button" type="button" data-order-remove="${o.id}">Удалить</button>
          </div>
        `;
        grid.appendChild(card);
      });

      root.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-order-remove]");
        if (!btn) return;
        const id = btn.getAttribute("data-order-remove");
        const next = orders.filter((o) => o?.id !== id);
        localStorage.setItem(ORDERS_KEY, JSON.stringify(next));
        renderOrdersList();
      });
    } catch {
      root.innerHTML = `<div class="promo_card"><p class="promo_title">Не удалось загрузить историю</p><p class="promo_text">Запусти сайт через локальный сервер.</p></div>`;
    }
  };

  const init = async () => {
    updateCartBadges();
    await Promise.all([
      renderProducts(),
      renderCategoryProducts(),
      renderCart(),
      renderCheckoutSummary(),
      renderOrder(),
      renderOrdersList(),
      updateTotals()
    ]);
    bindCartControls();
    bindAddToCart();
    bindCheckoutForm();
    initNavDropdown();
  };

  document.addEventListener("cart:changed", async () => {
    updateCartBadges();
    await Promise.all([renderCart(), renderCheckoutSummary(), updateTotals()]);
  });

  init();
})();

