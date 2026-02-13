async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Request failed');
  }
  return res.json();
}

const onLoginPage = location.pathname.includes('login');
const onDashboardPage = location.pathname.includes('dashboard');

function setState(id, text, mode = '') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = `notice${mode ? ` ${mode}` : ''}`;
}

function toLocal(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

if (onLoginPage) {
  const form = document.getElementById('loginForm');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setState('loginState', 'Signing in...');

    const payload = {
      username: form.username.value.trim(),
      password: form.password.value
    };

    try {
      await fetchJSON('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      location.href = '/admin/dashboard.html';
    } catch (err) {
      setState('loginState', err.message, 'error');
    }
  });
}

if (onDashboardPage) {
  const productForm = document.getElementById('productForm');
  const productsTable = document.getElementById('productsTable');
  const inquiriesTable = document.getElementById('inquiriesTable');
  const customersTable = document.getElementById('customersTable');
  const analyticsGrid = document.getElementById('analyticsGrid');
  const adminIdentity = document.getElementById('adminIdentity');
  const resetBtn = document.getElementById('resetProductForm');
  const logoutBtn = document.getElementById('logoutBtn');

  let products = [];

  function resetForm() {
    productForm.reset();
    productForm.productId.value = '';
    setState('productState', 'Create or edit inventory items here.');
  }

  function renderAnalytics(data) {
    analyticsGrid.innerHTML = `
      <article class="metric-card"><p>Total Products</p><strong>${data.totalProducts}</strong></article>
      <article class="metric-card"><p>Featured</p><strong>${data.featuredProducts}</strong></article>
      <article class="metric-card"><p>Available</p><strong>${data.availableProducts}</strong></article>
      <article class="metric-card"><p>Inquiries</p><strong>${data.totalInquiries}</strong></article>
      <article class="metric-card"><p>Customers</p><strong>${data.totalCustomers}</strong></article>
      <article class="metric-card"><p>Low Stock</p><strong>${data.lowStockProducts}</strong></article>
    `;
  }

  function renderProducts() {
    productsTable.innerHTML = products
      .map(
        (product) => `
      <tr>
        <td>${product.name}</td>
        <td>${product.category}</td>
        <td>${product.stock}</td>
        <td>
          <span class="tag ${product.is_available ? 'ok' : 'no'}">${product.is_available ? 'Available' : 'Unavailable'}</span>
          <span class="tag ${product.is_visible ? 'ok' : 'no'}">${product.is_visible ? 'Visible' : 'Hidden'}</span>
          <span class="tag ${product.featured ? 'ok' : ''}">${product.featured ? 'Featured' : 'Standard'}</span>
        </td>
        <td>
          <button class="secondary" data-edit="${product.id}">Edit</button>
          <button class="secondary" data-delete="${product.id}">Delete</button>
        </td>
      </tr>
    `
      )
      .join('');
  }

  function renderInquiries(inquiries) {
    inquiriesTable.innerHTML = inquiries
      .map(
        (inquiry) => `
      <tr>
        <td>${inquiry.name}</td>
        <td>${inquiry.email}<br/>${inquiry.phone}</td>
        <td>${inquiry.product_name || 'General'}${inquiry.product_category ? `<br/><small>${inquiry.product_category}</small>` : ''}</td>
        <td>${inquiry.message || '-'}</td>
        <td>
          <select data-inquiry-status="${inquiry.id}">
            <option value="new" ${inquiry.status === 'new' ? 'selected' : ''}>New</option>
            <option value="contacted" ${inquiry.status === 'contacted' ? 'selected' : ''}>Contacted</option>
            <option value="closed" ${inquiry.status === 'closed' ? 'selected' : ''}>Closed</option>
          </select>
        </td>
      </tr>
    `
      )
      .join('');
  }

  function renderCustomers(customers) {
    customersTable.innerHTML = customers
      .map(
        (customer) => `
      <tr>
        <td>${customer.name}</td>
        <td>${customer.email || '-'}</td>
        <td>${customer.phone || '-'}</td>
        <td>${toLocal(customer.last_inquiry_at)}</td>
      </tr>
    `
      )
      .join('');
  }

  async function loadDashboard() {
    const me = await fetchJSON('/api/auth/me');
    adminIdentity.textContent = `Signed in as ${me.admin.username}`;

    const [analytics, productsRes, inquiries, customers] = await Promise.all([
      fetchJSON('/api/admin/analytics'),
      fetchJSON('/api/admin/products'),
      fetchJSON('/api/admin/inquiries'),
      fetchJSON('/api/admin/customers')
    ]);

    products = productsRes;
    renderAnalytics(analytics);
    renderProducts();
    renderInquiries(inquiries);
    renderCustomers(customers);
  }

  productForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setState('productState', 'Saving product...');

    const formData = new FormData(productForm);
    const id = formData.get('id');
    const method = id ? 'PUT' : 'POST';
    const endpoint = id ? `/api/admin/products/${id}` : '/api/admin/products';

    try {
      await fetchJSON(endpoint, {
        method,
        body: formData
      });
      setState('productState', 'Product saved successfully.', 'ok');
      resetForm();
      await loadDashboard();
    } catch (err) {
      setState('productState', err.message, 'error');
    }
  });

  resetBtn?.addEventListener('click', resetForm);

  productsTable?.addEventListener('click', async (event) => {
    const editId = event.target.getAttribute('data-edit');
    const deleteId = event.target.getAttribute('data-delete');

    if (editId) {
      const product = products.find((item) => String(item.id) === editId);
      if (!product) return;

      productForm.productId.value = product.id;
      productForm.name.value = product.name;
      productForm.category.value = product.category;
      productForm.description.value = product.description;
      productForm.materials.value = product.materials;
      productForm.craftsmanship.value = product.craftsmanship;
      productForm.image_url.value = product.image_url || '';
      productForm.stock.value = product.stock;
      productForm.featured.value = String(product.featured);
      productForm.is_available.value = String(product.is_available);
      productForm.is_visible.value = String(product.is_visible);
      setState('productState', `Editing: ${product.name}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (deleteId) {
      const confirmed = window.confirm('Delete this product?');
      if (!confirmed) return;

      try {
        await fetchJSON(`/api/admin/products/${deleteId}`, { method: 'DELETE' });
        setState('productState', 'Product deleted.', 'ok');
        await loadDashboard();
      } catch (err) {
        setState('productState', err.message, 'error');
      }
    }
  });

  inquiriesTable?.addEventListener('change', async (event) => {
    const id = event.target.getAttribute('data-inquiry-status');
    if (!id) return;
    try {
      await fetchJSON(`/api/admin/inquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: event.target.value })
      });
    } catch (_err) {
      // ignore status update errors in UI flow
    }
  });

  logoutBtn?.addEventListener('click', async () => {
    await fetchJSON('/api/auth/logout', { method: 'POST' }).catch(() => null);
    location.href = '/admin/login.html';
  });

  loadDashboard().catch(() => {
    location.href = '/admin/login.html';
  });
}
