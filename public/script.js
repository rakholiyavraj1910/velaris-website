const header = document.querySelector('.site-header');
const revealEls = document.querySelectorAll('.reveal');

window.addEventListener('scroll', () => {
  if (!header) return;
  header.classList.toggle('scrolled', window.scrollY > 30);
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  },
  { threshold: 0.15 }
);

revealEls.forEach((el) => observer.observe(el));

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Request failed');
  }
  return res.json();
}

function productCard(product) {
  const unavailable = !product.is_available || product.stock <= 0;
  return `
    <article class="product-card reveal">
      <a href="/product.html?id=${product.id}">
        <img src="${product.image_url}" alt="${product.name}" loading="lazy" />
        ${unavailable ? '<span class="status-chip unavailable">Unavailable</span>' : '<span class="status-chip">Available</span>'}
        <div class="meta">
          <h3>${product.name}</h3>
          <p>${product.materials}</p>
        </div>
      </a>
    </article>
  `;
}

function attachReveals(container) {
  container.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
}

async function loadCategoryProducts(category) {
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading">Loading curated products...</div>';
  try {
    const products = await fetchJSON(`/api/products?category=${encodeURIComponent(category)}`);
    if (!products.length) {
      grid.innerHTML = '<div class="empty">No visible products in this collection yet.</div>';
      return;
    }

    grid.innerHTML = products.map(productCard).join('');
    attachReveals(grid);
  } catch (err) {
    grid.innerHTML = `<div class="empty">${err.message}</div>`;
  }
}

async function loadFeaturedProducts() {
  const grid = document.getElementById('featuredGrid');
  if (!grid) return;

  grid.innerHTML = '<div class="loading">Loading featured pieces...</div>';
  try {
    const products = await fetchJSON('/api/products?featured=true');
    grid.innerHTML = (products.length ? products.slice(0, 6) : []).map(productCard).join('');
    if (!products.length) {
      grid.innerHTML = '<div class="empty">Featured curation will appear here shortly.</div>';
      return;
    }
    attachReveals(grid);
  } catch (err) {
    grid.innerHTML = `<div class="empty">${err.message}</div>`;
  }
}

async function loadProductDetail() {
  const mount = document.getElementById('productDetailMount');
  if (!mount) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    mount.innerHTML = '<div class="empty">No product selected.</div>';
    return;
  }

  mount.innerHTML = '<div class="loading">Loading product story...</div>';
  try {
    const product = await fetchJSON(`/api/products/${id}`);
    const unavailable = !product.is_available || product.stock <= 0;
    mount.innerHTML = `
      <div class="detail-image reveal">
        <img src="${product.image_url}" alt="${product.name}" />
      </div>
      <div class="detail-content reveal">
        <p class="eyebrow">${product.category}</p>
        <h1>${product.name}</h1>
        <div class="detail-section">
          <h3>Materials</h3>
          <p>${product.materials}</p>
        </div>
        <div class="detail-section">
          <h3>Craftsmanship</h3>
          <p>${product.craftsmanship}</p>
        </div>
        <div class="detail-section">
          <h3>Design Story</h3>
          <p>${product.description}</p>
        </div>
        <p class="notice ${unavailable ? 'error' : 'success'}">${unavailable ? 'Currently unavailable for immediate placement.' : 'Available for private consultation and inquiry.'}</p>
        <a class="btn" href="/contact.html?productId=${product.id}">Inquire</a>
      </div>
    `;
    attachReveals(mount);
  } catch (err) {
    mount.innerHTML = `<div class="empty">${err.message}</div>`;
  }
}

async function setupInquiryForm() {
  const form = document.getElementById('inquiryForm');
  const productSelect = document.getElementById('productId');
  const state = document.getElementById('formState');
  if (!form || !productSelect) return;

  try {
    const products = await fetchJSON('/api/products');
    products.forEach((product) => {
      const option = document.createElement('option');
      option.value = product.id;
      option.textContent = product.name;
      productSelect.appendChild(option);
    });
  } catch (_err) {
    // keep form usable without product options
  }

  const params = new URLSearchParams(window.location.search);
  const productId = params.get('productId');
  if (productId) productSelect.value = productId;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    state.textContent = 'Submitting...';
    state.className = 'notice';

    const payload = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      message: form.message.value.trim(),
      productId: form.productId.value || null
    };

    try {
      await fetchJSON('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      form.reset();
      state.textContent = 'Inquiry submitted. Our concierge will contact you shortly.';
      state.className = 'notice success';
    } catch (err) {
      state.textContent = err.message;
      state.className = 'notice error';
    }
  });
}

function initPage() {
  const page = document.body.dataset.page;
  if (page === 'home') loadFeaturedProducts();
  if (page === 'category') loadCategoryProducts(document.body.dataset.category);
  if (page === 'product') loadProductDetail();
  if (page === 'contact') setupInquiryForm();
}

initPage();
