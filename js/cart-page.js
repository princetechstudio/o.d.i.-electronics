// Cart page renderer (reads localStorage set by js/cart.js)
(function(){
  function $(sel){ return document.querySelector(sel); }

  function ensureCart(){
    if(!window.odiCart){
      console.error('odiCart not found');
      return null;
    }
    return window.odiCart;
  }

  function formatGhs(amount){
    return window.odiCart?.formatGhs ? window.odiCart.formatGhs(amount) : ('GHS ' + Number(amount||0).toFixed(2));
  }

  function buildCartItemRow(item){
    const img = item.image || 'images/placeholder.svg';
    const name = item.name || 'Product';
    const price = Number(item.price || 0);
    const qty = Number(item.qty || 0);
    const subtotal = price * qty;

    const el = document.createElement('div');
    el.className = 'cart-item';
    el.dataset.productId = String(item.id);
    el.innerHTML = `
      <div class="cart-img"><img src="${img}" alt="${name}" onerror="this.onerror=null;this.src='images/placeholder.svg'"/></div>
      <div class="item-info">
        <h3>${name}</h3>
        <p>Each: <strong style="color:var(--purple)">${formatGhs(price)}</strong></p>
        <p style="margin-top:6px">Subtotal: <strong style="color:var(--dark)">${formatGhs(subtotal)}</strong></p>
      </div>
      <div class="item-meta">
        <strong>${formatGhs(price)}</strong>
        <div class="qty" aria-label="Quantity controls">
          <button type="button" class="qty-minus" aria-label="Decrease quantity">−</button>
          <span class="qty-value">${qty}</span>
          <button type="button" class="qty-plus" aria-label="Increase quantity">+</button>
        </div>
      </div>
    `;

    el.querySelector('.qty-minus').addEventListener('click', ()=>{
      const next = qty - 1;
      window.odiCart.setQty(item.id, next);
      render();
    });
    el.querySelector('.qty-plus').addEventListener('click', ()=>{
      const next = qty + 1;
      window.odiCart.setQty(item.id, next);
      render();
    });

    return el;
  }

  function computeTotals(items){
    const subtotal = items.reduce((sum, it)=> sum + Number(it.price||0) * Number(it.qty||0), 0);
    // This is a simple static delivery rule for the demo.
    const delivery = subtotal > 0 ? 150 : 0;
    const total = subtotal + delivery;
    return { subtotal, delivery, total };
  }

  function buildCheckoutMessage(items, totals){
    const lines = items.map((item, index) => {
      const qty = Number(item.qty || 0);
      const price = Number(item.price || 0);
      return `${index + 1}. ${item.name} x${qty} - ${formatGhs(price * qty)}`;
    });

    return [
      'Hello O.D.I. Electronics, I want to proceed with this order:',
      '',
      ...lines,
      '',
      `Subtotal: ${formatGhs(totals.subtotal)}`,
      `Delivery: ${formatGhs(totals.delivery)}`,
      `Total: ${formatGhs(totals.total)}`,
      '',
      'Please confirm stock, delivery details and payment options.'
    ].join('\n');
  }

  function getCustomer(){
    const email = document.querySelector('#checkout-email')?.value.trim() || '';
    const phone = document.querySelector('#checkout-phone')?.value.trim() || '';
    return { email, phone };
  }

  function buildReference(){
    return 'ODI-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function savePaidOrder(items, totals, transaction, customer){
    const order = {
      reference: transaction.reference || transaction.trxref || buildReference(),
      transaction,
      customer,
      items,
      totals,
      paidAt: new Date().toISOString()
    };
    const raw = localStorage.getItem('odi_orders_v1');
    let orders = [];
    try { orders = raw ? JSON.parse(raw) : []; } catch { orders = []; }
    orders.unshift(order);
    localStorage.setItem('odi_orders_v1', JSON.stringify(orders.slice(0, 20)));
    return order;
  }

  function validateCheckout(items, customer){
    if(!items.length) return 'Your cart is empty.';
    if(!customer.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)){
      return 'Please enter a valid email address for Paystack checkout.';
    }
    if(!customer.phone){
      return 'Please enter your phone number.';
    }
    return '';
  }

  function openWhatsappCheckout(){
    const cart = ensureCart();
    if(!cart) return;

    const items = cart.getCartItems();
    if(!items.length) return;

    const totals = computeTotals(items);
    const message = buildCheckoutMessage(items, totals);
    window.open('https://wa.me/233550900600?text=' + encodeURIComponent(message), '_blank', 'noopener');
  }

  function checkout(){
    const cart = ensureCart();
    if(!cart) return;

    const items = cart.getCartItems();
    const totals = computeTotals(items);
    const customer = getCustomer();
    const validationMessage = validateCheckout(items, customer);
    if(validationMessage){
      alert(validationMessage);
      return;
    }

    const key = window.ODI_PAYSTACK_PUBLIC_KEY || '';
    if(!key || key.includes('REPLACE_WITH_YOUR_PAYSTACK_PUBLIC_KEY')){
      alert('Add your Paystack public key in cart.html by replacing pk_test_REPLACE_WITH_YOUR_PAYSTACK_PUBLIC_KEY.');
      return;
    }
    if(typeof Paystack === 'undefined'){
      alert('Paystack checkout could not load. Please check your internet connection and try again.');
      return;
    }

    const reference = buildReference();
    const popup = new Paystack();
    popup.newTransaction({
      key,
      email: customer.email,
      phone: customer.phone,
      amount: Math.round(totals.total * 100),
      currency: 'GHS',
      reference,
      metadata: {
        custom_fields: [
          {
            display_name: 'Phone Number',
            variable_name: 'phone_number',
            value: customer.phone
          },
          {
            display_name: 'Cart Items',
            variable_name: 'cart_items',
            value: items.map(item => `${item.name} x${item.qty}`).join(', ')
          }
        ],
        cart: items.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.qty,
          price: item.price
        }))
      },
      onSuccess: transaction => {
        savePaidOrder(items, totals, transaction, customer);
        cart.clearCart();
        cart.updateCartBadge();
        render();
        alert('Payment successful. Reference: ' + (transaction.reference || reference));
      },
      onCancel: () => {
        console.log('Paystack checkout cancelled');
      },
      onError: error => {
        console.error(error);
        alert('Paystack error: ' + (error.message || 'Unable to start payment.'));
      }
    });
  }

  function render(){
    const cart = ensureCart();
    if(!cart) return;

    const items = cart.getCartItems();
    const grid = document.querySelector('.cart-card');

    // Inject cart items into cart-card
    if(!grid) return;

    if(!items.length){
      grid.innerHTML = `
        <div class="empty-state">
          <div class="placeholder">Your cart is empty. Browse <a href="appliances.html">appliances</a> to add items.</div>
        </div>
      `;

      const checkoutBtn = document.querySelector('.checkout-btn');
      if(checkoutBtn){
        checkoutBtn.disabled = true;
        checkoutBtn.style.opacity = '.6';
        checkoutBtn.style.cursor = 'not-allowed';
      }

      const setTotals = (sub, del, tot)=>{
        const subEl = document.querySelector('[data-total-subtotal]');
        const delEl = document.querySelector('[data-total-delivery]');
        const totEl = document.querySelector('[data-total-total]');
        if(subEl) subEl.textContent = formatGhs(sub);
        if(delEl) delEl.textContent = formatGhs(del);
        if(totEl) totEl.textContent = formatGhs(tot);
      };
      setTotals(0,0,0);

      return;
    }

    const wrapper = document.createElement('div');
    wrapper.style.padding = '0';

    // header spacer
    items.forEach(it=> wrapper.appendChild(buildCartItemRow(it)));

    grid.innerHTML = '';
    const cardShell = document.createElement('div');
    cardShell.style.padding = '0';
    cardShell.appendChild(wrapper);
    grid.appendChild(cardShell);

    const totals = computeTotals(items);

    const subEl = document.querySelector('[data-total-subtotal]');
    const delEl = document.querySelector('[data-total-delivery]');
    const totEl = document.querySelector('[data-total-total]');
    if(subEl) subEl.textContent = formatGhs(totals.subtotal);
    if(delEl) delEl.textContent = formatGhs(totals.delivery);
    if(totEl) totEl.textContent = formatGhs(totals.total);

    const checkoutBtn = document.querySelector('.checkout-btn');
    if(checkoutBtn){
      checkoutBtn.disabled = false;
      checkoutBtn.style.opacity = '1';
      checkoutBtn.style.cursor = 'pointer';
    }

    cart.updateCartBadge();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => {
      render();
      const checkoutBtn = document.querySelector('.checkout-btn');
      if(checkoutBtn) checkoutBtn.addEventListener('click', checkout);
      const whatsappBtn = document.querySelector('[data-whatsapp-checkout]');
      if(whatsappBtn) whatsappBtn.addEventListener('click', openWhatsappCheckout);
    });
  } else {
    render();
    const checkoutBtn = document.querySelector('.checkout-btn');
    if(checkoutBtn) checkoutBtn.addEventListener('click', checkout);
    const whatsappBtn = document.querySelector('[data-whatsapp-checkout]');
    if(whatsappBtn) whatsappBtn.addEventListener('click', openWhatsappCheckout);
  }
})();

