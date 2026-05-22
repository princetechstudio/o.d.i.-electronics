// Simple localStorage-based cart for the static site.
// Stores cart as: { items: { [productId]: { id, name, price, image, qty } }, updatedAt: number }

(function(){
  const STORAGE_KEY = 'odi_cart_v1';

  function safeParse(json, fallback){
    try { return JSON.parse(json); } catch { return fallback; }
  }

  function loadCart(){
    const raw = localStorage.getItem(STORAGE_KEY);
    const fallback = { items: {}, updatedAt: Date.now() };
    if(!raw) return fallback;
    const parsed = safeParse(raw, fallback);
    if(!parsed || typeof parsed !== 'object' || !parsed.items) return fallback;
    return parsed;
  }

  function saveCart(cart){
    cart.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }

  function normalizeProduct(product){
    // Accept either a product object from products.json or a minimal object we build on the fly.
    if(!product) throw new Error('Missing product');
    const id = Number(product.id);
    if(!Number.isFinite(id)) throw new Error('Invalid product id');

    return {
      id,
      name: String(product.name || ''),
      price: Number(product.price || 0),
      image: product.image ? String(product.image) : (product.img ? String(product.img) : undefined),
      qty: 1
    };
  }

  function addToCart(product, qty = 1){
    const cart = loadCart();
    const p = normalizeProduct(product);
    const addQty = Math.max(1, Number(qty || 1));

    if(!cart.items[p.id]){
      cart.items[p.id] = { id: p.id, name: p.name, price: p.price, image: p.image, qty: 0 };
    }
    cart.items[p.id].qty += addQty;
    saveCart(cart);
    return cart.items[p.id];
  }

  function setQty(productId, qty){
    const cart = loadCart();
    const id = Number(productId);
    if(!cart.items[id]) return;

    const next = Math.max(0, Number(qty || 0));
    if(next <= 0){
      delete cart.items[id];
    } else {
      cart.items[id].qty = next;
    }
    saveCart(cart);
  }

  function clearCart(){
    localStorage.removeItem(STORAGE_KEY);
  }

  function getCartItems(){
    const cart = loadCart();
    return Object.values(cart.items || {}).sort((a,b)=>a.id-b.id);
  }

  function getCartCount(){
    const items = getCartItems();
    return items.reduce((sum, it)=> sum + (Number(it.qty)||0), 0);
  }

  function formatGhs(amount){
    const n = Number(amount || 0);
    return 'GHS ' + n.toFixed(2);
  }

  function updateCartBadge(){
    const badge = document.querySelector('.cart-badge');
    if(!badge) return;
    badge.textContent = String(getCartCount());
  }

  function bindAddToCartButtons(){
    document.addEventListener('click', event => {
      const btn = event.target.closest('[data-add-to-cart]');
      if(!btn) return;

      event.preventDefault();
      const product = {
        id: btn.getAttribute('data-product-id'),
        name: btn.getAttribute('data-product-name'),
        price: btn.getAttribute('data-product-price'),
        image: btn.getAttribute('data-product-image')
      };

      try{
        addToCart(product, btn.getAttribute('data-product-qty') || 1);
        updateCartBadge();

        const original = btn.innerHTML;
        btn.innerHTML = btn.getAttribute('data-added-label') || 'Added!';
        btn.disabled = true;
        btn.classList.add('cart-added');
        setTimeout(() => {
          btn.innerHTML = original;
          btn.disabled = false;
          btn.classList.remove('cart-added');
        }, 1200);
      }catch(error){
        console.error(error);
        alert('Failed to add item to cart. Please try again.');
      }
    });
  }

  // Expose globals for inline handlers in existing pages
  window.odiCart = {
    addToCart,
    setQty,
    clearCart,
    getCartItems,
    getCartCount,
    formatGhs,
    updateCartBadge
  };

  // Auto-update badge when script loads
  if(typeof document !== 'undefined'){
    bindAddToCartButtons();
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', updateCartBadge);
    } else {
      updateCartBadge();
    }
  }
})();

