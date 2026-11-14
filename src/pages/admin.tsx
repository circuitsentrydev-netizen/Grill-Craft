import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowDownUp,
  Check,
  CircleAlert,
  Flame,
  LogOut,
  Plus,
  RefreshCw,
  Tag,
  X,
} from 'lucide-react';
import './admin.css';

type OrderStatus = 'new' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';

type Order = {
  id: string;
  customerName: string;
  phone: string;
  itemName: string;
  flavour: string;
  quantity: number;
  totalRand: number;
  notes: string | null;
  status: OrderStatus;
  createdAt: string;
};

type Deal = {
  id: string;
  title: string;
  description: string;
  priceRand: number;
  originalPriceRand: number | null;
  imageUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  createdAt: string;
};

type Admin = { email: string };
type ApiMessage = { error?: string; message?: string };
type DealForm = {
  title: string;
  description: string;
  priceRand: string;
  originalPriceRand: string;
  imageUrl: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
};

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const statusLabels: Record<OrderStatus, string> = {
  new: 'New',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const emptyDeal: DealForm = {
  title: '',
  description: '',
  priceRand: '',
  originalPriceRand: '',
  imageUrl: '',
  startsAt: '',
  endsAt: '',
  active: true,
};

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError('Could not reach Grill Craft. Check your connection and try again.', 0);
  }

  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new ApiError(
      'The Vercel admin API is not available in this preview. Configure and deploy the Vercel project to use admin tools.',
      response.status || 503,
    );
  }
  if (!response.ok) {
    let message = 'Something went wrong. Please try again.';
    try {
      const body = (await response.json()) as ApiMessage;
      message = body.error || body.message || message;
    } catch {
      // Keep the useful fallback message when the server has no JSON body.
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function formatRand(value: number) {
  return `R${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function toIsoOrUndefined(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function AdminPage() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [dealsError, setDealsError] = useState('');
  const [dealForm, setDealForm] = useState<DealForm>(emptyDeal);
  const [dealErrors, setDealErrors] = useState<Record<string, string>>({});
  const [dealPending, setDealPending] = useState(false);
  const [savingOrder, setSavingOrder] = useState<string | null>(null);
  const [togglingDeal, setTogglingDeal] = useState<string | null>(null);
  const [logoutPending, setLogoutPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleUnauthorized = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      setAdmin(null);
      setOrders([]);
      setDeals([]);
      setLoginPassword('');
      setLoginError('Your session has ended. Sign in again to continue.');
      return true;
    }
    return false;
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError('');
    try {
      const result = await apiRequest<{ orders: Order[] }>('/api/orders');
      setOrders(result.orders);
    } catch (error) {
      if (!handleUnauthorized(error)) {
        setOrdersError(error instanceof Error ? error.message : 'Orders could not be loaded.');
      }
    } finally {
      setOrdersLoading(false);
    }
  }, [handleUnauthorized]);

  const loadDeals = useCallback(async () => {
    setDealsLoading(true);
    setDealsError('');
    try {
      const result = await apiRequest<{ deals: Deal[] }>('/api/admin/deals');
      setDeals(result.deals);
    } catch (error) {
      if (!handleUnauthorized(error)) {
        setDealsError(error instanceof Error ? error.message : 'Offers could not be loaded.');
      }
    } finally {
      setDealsLoading(false);
    }
  }, [handleUnauthorized]);

  const refreshLists = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadOrders(), loadDeals()]);
    setRefreshing(false);
  }, [loadDeals, loadOrders]);

  useEffect(() => {
    let mounted = true;
    apiRequest<{ admin: Admin }>('/api/admin/session')
      .then((result) => {
        if (mounted) setAdmin(result.admin);
      })
      .catch((error: unknown) => {
        if (mounted && !(error instanceof ApiError && error.status === 401)) {
          setLoginError(error instanceof Error ? error.message : 'Could not check your session.');
        }
      })
      .finally(() => {
        if (mounted) setSessionLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!admin) return;
    void refreshLists();
    const timer = window.setInterval(() => {
      void Promise.all([loadOrders(), loadDeals()]);
    }, 12000);
    return () => window.clearInterval(timer);
  }, [admin, loadDeals, loadOrders, refreshLists]);

  const activeOrders = useMemo(
    () => orders.filter((order) => !['completed', 'cancelled'].includes(order.status)),
    [orders],
  );
  const publishedDeals = useMemo(() => deals.filter((deal) => deal.active).length, [deals]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError('');
    if (!loginEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim())) {
      setLoginError('Enter a valid email address.');
      return;
    }
    if (!loginPassword) {
      setLoginError('Enter your password.');
      return;
    }
    setLoginPending(true);
    try {
      const result = await apiRequest<{ admin: Admin }>('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      });
      setAdmin(result.admin);
      setLoginPassword('');
      setLoginError('');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Sign in failed. Try again.');
    } finally {
      setLoginPending(false);
    }
  };

  const handleLogout = async () => {
    setLogoutPending(true);
    try {
      await apiRequest<{ success: true }>('/api/admin/logout', { method: 'POST' });
      setAdmin(null);
      setOrders([]);
      setDeals([]);
      setNotice('');
      setNoticeError(false);
      setLoginError('');
      setLoginPassword('');
      setLoginEmail('');
    } catch (error) {
      if (!handleUnauthorized(error)) {
        setNotice(error instanceof Error ? error.message : 'Could not sign out.');
        setNoticeError(true);
      }
    } finally {
      setLogoutPending(false);
    }
  };

  const updateOrderStatus = async (order: Order, status: OrderStatus) => {
    if (status === order.status) return;
    setSavingOrder(order.id);
    setNotice('');
    setNoticeError(false);
    try {
      await apiRequest<{ order: Order }>(`/api/orders/${encodeURIComponent(order.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setNotice(`Order for ${order.customerName} marked ${statusLabels[status].toLowerCase()}.`);
      await refreshLists();
    } catch (error) {
      if (!handleUnauthorized(error)) {
        setNotice(error instanceof Error ? error.message : 'Order status could not be changed.');
        setNoticeError(true);
      }
    } finally {
      setSavingOrder(null);
    }
  };

  const validateDeal = () => {
    const errors: Record<string, string> = {};
    if (!dealForm.title.trim()) errors.title = 'Add a clear offer title.';
    else if (dealForm.title.trim().length > 80) errors.title = 'Keep the title under 80 characters.';
    if (!dealForm.description.trim()) errors.description = 'Add a short description.';
    else if (dealForm.description.trim().length > 400) errors.description = 'Keep the description under 400 characters.';
    const price = Number(dealForm.priceRand);
    if (!dealForm.priceRand || !Number.isFinite(price) || price <= 0) errors.priceRand = 'Enter a price greater than R0.';
    if (dealForm.originalPriceRand) {
      const original = Number(dealForm.originalPriceRand);
      if (!Number.isFinite(original) || original <= 0) errors.originalPriceRand = 'Enter a valid original price.';
      else if (Number.isFinite(price) && original <= price) errors.originalPriceRand = 'Original price must be higher than the offer price.';
    }
    if (dealForm.imageUrl) {
      try {
        const url = new URL(dealForm.imageUrl);
        if (url.protocol !== 'https:') errors.imageUrl = 'Use an https image link.';
      } catch {
        errors.imageUrl = 'Enter a valid image URL.';
      }
    }
    if (dealForm.startsAt && dealForm.endsAt && new Date(dealForm.endsAt) <= new Date(dealForm.startsAt)) {
      errors.endsAt = 'The end date must be after the start date.';
    }
    if (dealForm.startsAt && Number.isNaN(new Date(dealForm.startsAt).getTime())) errors.startsAt = 'Choose a valid start date.';
    if (dealForm.endsAt && Number.isNaN(new Date(dealForm.endsAt).getTime())) errors.endsAt = 'Choose a valid end date.';
    setDealErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateDeal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice('');
    setNoticeError(false);
    if (!validateDeal()) return;
    setDealPending(true);
    const payload = {
      title: dealForm.title.trim(),
      description: dealForm.description.trim(),
      priceRand: Number(dealForm.priceRand),
      ...(dealForm.originalPriceRand ? { originalPriceRand: Number(dealForm.originalPriceRand) } : {}),
      ...(dealForm.imageUrl.trim() ? { imageUrl: dealForm.imageUrl.trim() } : {}),
      ...(dealForm.startsAt ? { startsAt: toIsoOrUndefined(dealForm.startsAt) } : {}),
      ...(dealForm.endsAt ? { endsAt: toIsoOrUndefined(dealForm.endsAt) } : {}),
      active: dealForm.active,
    };
    try {
      await apiRequest<{ deal: Deal }>('/api/deals', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setDealForm(emptyDeal);
      setDealErrors({});
      setNotice('Offer created. Your front page is up to date.');
      await refreshLists();
    } catch (error) {
      if (!handleUnauthorized(error)) {
        setNotice(error instanceof Error ? error.message : 'Offer could not be created.');
        setNoticeError(true);
      }
    } finally {
      setDealPending(false);
    }
  };

  const toggleDeal = async (deal: Deal) => {
    setTogglingDeal(deal.id);
    setNotice('');
    setNoticeError(false);
    try {
      await apiRequest<{ deal: Deal }>(`/api/deals/${encodeURIComponent(deal.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !deal.active }),
      });
      setNotice(`Offer ${deal.active ? 'unpublished' : 'published'} successfully.`);
      await refreshLists();
    } catch (error) {
      if (!handleUnauthorized(error)) {
        setNotice(error instanceof Error ? error.message : 'Offer publication could not be changed.');
        setNoticeError(true);
      }
    } finally {
      setTogglingDeal(null);
    }
  };

  if (sessionLoading) {
    return (
      <main className="gc-admin gc-admin-auth" aria-busy="true">
        <div className="gc-auth-card gc-skeleton" aria-label="Checking sign-in status">
          <span className="gc-skeleton-mark" />
          <span className="gc-skeleton-line gc-skeleton-long" />
          <span className="gc-skeleton-line" />
          <span className="gc-skeleton-block" />
        </div>
      </main>
    );
  }

  if (!admin) {
    return (
      <main className="gc-admin gc-admin-auth">
        <section className="gc-auth-card" aria-labelledby="gc-login-title">
          <div className="gc-brand-lockup">
            <span className="gc-brand-mark"><Flame size={24} aria-hidden="true" /></span>
            <span><strong>GRILL CRAFT</strong><small>OWNER’S COUNTER</small></span>
          </div>
          <p className="gc-kicker">A good day starts here</p>
          <h1 id="gc-login-title">Back of<br /><em>house.</em></h1>
          <p className="gc-auth-copy">Sign in to keep the orders moving and the specials fresh.</p>
          <form className="gc-login-form" onSubmit={handleLogin} noValidate>
            <label htmlFor="gc-login-email">Email address</label>
            <input
              id="gc-login-email"
              type="email"
              autoComplete="username"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              placeholder="Enter your admin email"
              data-testid="input-login-email"
              required
            />
            <label htmlFor="gc-login-password">Password</label>
            <input
              id="gc-login-password"
              type="password"
              autoComplete="current-password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              placeholder="Your password"
              data-testid="input-login-password"
              required
            />
            {loginError && <p className="gc-form-alert" role="alert" data-testid="status-login-error"><CircleAlert size={16} />{loginError}</p>}
            <button className="gc-button gc-button-primary gc-login-submit" type="submit" disabled={loginPending} data-testid="button-login">
              {loginPending ? <><span className="gc-button-pulse" />Checking credentials</> : <>Enter the counter <ArrowDownUp size={16} aria-hidden="true" /></>}
            </button>
          </form>
          <p className="gc-auth-foot">One kitchen. One owner account. Keep it close.</p>
        </section>
        <div className="gc-auth-side" aria-hidden="true">
          <div className="gc-auth-side-ring" />
          <span>FIRE<br />FLAVOUR<br />FAMILY</span>
          <small>GRILL CRAFT · (PTY) LTD.</small>
        </div>
      </main>
    );
  }

  return (
    <main className="gc-admin gc-admin-console">
      <header className="gc-topbar">
        <div className="gc-brand-lockup">
          <span className="gc-brand-mark"><Flame size={23} aria-hidden="true" /></span>
          <span><strong>GRILL CRAFT</strong><small>OWNER’S COUNTER</small></span>
        </div>
        <div className="gc-topbar-right">
          <span className="gc-live-indicator"><i /> Counter open</span>
          <span className="gc-account-email">{admin.email}</span>
          <button className="gc-signout" onClick={handleLogout} disabled={logoutPending} data-testid="button-logout">
            <LogOut size={15} aria-hidden="true" /><span>{logoutPending ? 'Signing out' : 'Sign out'}</span>
          </button>
        </div>
      </header>

      <div className="gc-dashboard">
        <section className="gc-page-heading">
          <div>
            <p className="gc-kicker"><span /> The owner’s counter</p>
            <h1>Good morning.<br /><em>Let’s get cooking.</em></h1>
            <p className="gc-heading-note">Your orders, your offers. All in one place.</p>
          </div>
          <div className="gc-heading-actions">
            <div className="gc-date-stamp"><span>TODAY AT THE COUNTER</span><strong>{new Intl.DateTimeFormat('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</strong></div>
            <button className="gc-button gc-button-quiet" onClick={() => void refreshLists()} disabled={refreshing} data-testid="button-refresh">
              <RefreshCw size={15} className={refreshing ? 'gc-spinning' : ''} aria-hidden="true" /> Refresh
            </button>
          </div>
        </section>

        {notice && (
          <div className={`gc-notice${noticeError ? ' is-error' : ''}`} role={noticeError ? 'alert' : 'status'} data-testid="status-admin-notice">
            {noticeError ? <CircleAlert size={16} /> : <Check size={16} />}
            <span>{notice}</span>
            <button aria-label="Dismiss message" onClick={() => { setNotice(''); setNoticeError(false); }} data-testid="button-dismiss-notice"><X size={15} /></button>
          </div>
        )}

        <section className="gc-summary-strip" aria-label="Counter summary">
          <div className="gc-summary-cell">
            <span className="gc-summary-label">Orders in motion</span>
            <strong data-testid="text-active-orders">{activeOrders.length.toString().padStart(2, '0')}</strong>
            <small>Not yet completed</small>
          </div>
          <div className="gc-summary-cell gc-summary-cell-accent">
            <span className="gc-summary-label">New orders</span>
            <strong data-testid="text-new-orders">{orders.filter((order) => order.status === 'new').length.toString().padStart(2, '0')}</strong>
            <small>Ready for your attention</small>
          </div>
          <div className="gc-summary-cell">
            <span className="gc-summary-label">Live on the front page</span>
            <strong data-testid="text-published-deals">{publishedDeals.toString().padStart(2, '0')}</strong>
            <small>Published offers</small>
          </div>
          <div className="gc-summary-aside"><Flame size={19} aria-hidden="true" /><span>Made over<br />real fire.</span></div>
        </section>

        <div className="gc-workspace">
          <section className="gc-panel gc-orders-panel" aria-labelledby="gc-orders-title">
            <div className="gc-panel-heading">
              <div>
                <p className="gc-section-index">01 / INCOMING</p>
                <h2 id="gc-orders-title">The order rail<span className="gc-title-count">{orders.length}</span></h2>
                <p>Every order, from first hello to ready to collect.</p>
              </div>
              <button className="gc-icon-refresh" aria-label="Refresh orders" onClick={() => void loadOrders()} disabled={ordersLoading} data-testid="button-refresh-orders">
                <RefreshCw size={16} className={ordersLoading ? 'gc-spinning' : ''} aria-hidden="true" />
              </button>
            </div>

            {ordersError ? (
              <div className="gc-state gc-state-error" role="alert" data-testid="status-orders-error">
                <CircleAlert size={21} />
                <strong>Orders didn’t come through.</strong>
                <span>{ordersError}</span>
                <button className="gc-text-button" onClick={() => void loadOrders()} data-testid="button-retry-orders">Try again</button>
              </div>
            ) : ordersLoading && orders.length === 0 ? (
              <div className="gc-order-skeletons" aria-label="Loading orders" aria-busy="true">
                {[1, 2, 3].map((item) => <div className="gc-order-skeleton" key={item}><i /><span /><span /></div>)}
              </div>
            ) : orders.length === 0 ? (
              <div className="gc-state gc-state-empty" data-testid="status-orders-empty">
                <span className="gc-empty-mark"><Flame size={22} /></span>
                <strong>No orders on the rail.</strong>
                <span>When a customer places an order, it’ll show up here.</span>
              </div>
            ) : (
              <div className="gc-order-list" aria-live="polite">
                {orders.map((order) => (
                  <article className={`gc-order-row status-${order.status}`} key={order.id} data-testid={`card-order-${order.id}`}>
                    <div className="gc-order-main">
                      <div className="gc-order-person">
                        <span className="gc-order-initial" aria-hidden="true">{order.customerName.trim().charAt(0).toUpperCase() || 'G'}</span>
                        <div><strong data-testid={`text-order-customer-${order.id}`}>{order.customerName}</strong><small>{order.phone}</small></div>
                      </div>
                      <div className="gc-order-details">
                         <span>{order.quantity} × {order.itemName} · {order.flavour}</span>
                        {order.notes && <small className="gc-order-note">“{order.notes}”</small>}
                      </div>
                      <div className="gc-order-total">
                        <strong>{formatRand(order.totalRand)}</strong>
                        <small>{formatWhen(order.createdAt)}</small>
                      </div>
                    </div>
                    <div className="gc-order-actions">
                      <span className={`gc-status-pill status-${order.status}`} data-testid={`status-order-${order.id}`}>{statusLabels[order.status]}</span>
                      <label className="gc-sr-only" htmlFor={`status-${order.id}`}>Change status for {order.customerName}</label>
                      <select
                        id={`status-${order.id}`}
                        value={order.status}
                        disabled={savingOrder === order.id}
                        onChange={(event) => void updateOrderStatus(order, event.target.value as OrderStatus)}
                        data-testid={`select-order-status-${order.id}`}
                      >
                        {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      {savingOrder === order.id && <span className="gc-saving-label" role="status">Saving</span>}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="gc-side-column">
            <section className="gc-panel gc-deal-form-panel" aria-labelledby="gc-create-deal-title">
              <div className="gc-panel-heading gc-deal-heading">
                <div>
                  <p className="gc-section-index">02 / FRONT PAGE</p>
                  <h2 id="gc-create-deal-title">Put on a special</h2>
                  <p>Make an offer worth gathering for.</p>
                </div>
                <span className="gc-deal-icon"><Tag size={19} aria-hidden="true" /></span>
              </div>
              <form className="gc-deal-form" onSubmit={handleCreateDeal} noValidate>
                <div className="gc-field">
                  <label htmlFor="deal-title">Offer title <span>Required</span></label>
                  <input id="deal-title" value={dealForm.title} maxLength={80} onChange={(event) => setDealForm({ ...dealForm, title: event.target.value })} placeholder="e.g. Saturday Spread" aria-invalid={!!dealErrors.title} aria-describedby={dealErrors.title ? 'deal-title-error' : undefined} data-testid="input-deal-title" />
                  {dealErrors.title && <small className="gc-field-error" id="deal-title-error">{dealErrors.title}</small>}
                </div>
                <div className="gc-field">
                  <label htmlFor="deal-description">A few details <span>Required</span></label>
                  <textarea id="deal-description" rows={3} maxLength={400} value={dealForm.description} onChange={(event) => setDealForm({ ...dealForm, description: event.target.value })} placeholder="What’s included? Keep it hungry." aria-invalid={!!dealErrors.description} aria-describedby={dealErrors.description ? 'deal-description-error' : undefined} data-testid="input-deal-description" />
                  <div className="gc-input-meta"><small>{dealForm.description.length}/400</small>{dealErrors.description && <small className="gc-field-error" id="deal-description-error">{dealErrors.description}</small>}</div>
                </div>
                <div className="gc-field-row">
                  <div className="gc-field">
                    <label htmlFor="deal-price">Offer price <span>R</span></label>
                    <input id="deal-price" type="number" min="0.01" step="0.01" inputMode="decimal" value={dealForm.priceRand} onChange={(event) => setDealForm({ ...dealForm, priceRand: event.target.value })} placeholder="200" aria-invalid={!!dealErrors.priceRand} aria-describedby={dealErrors.priceRand ? 'deal-price-error' : undefined} data-testid="input-deal-price" />
                    {dealErrors.priceRand && <small className="gc-field-error" id="deal-price-error">{dealErrors.priceRand}</small>}
                  </div>
                  <div className="gc-field">
                    <label htmlFor="deal-original-price">Was <span>Optional</span></label>
                    <input id="deal-original-price" type="number" min="0.01" step="0.01" inputMode="decimal" value={dealForm.originalPriceRand} onChange={(event) => setDealForm({ ...dealForm, originalPriceRand: event.target.value })} placeholder="250" aria-invalid={!!dealErrors.originalPriceRand} aria-describedby={dealErrors.originalPriceRand ? 'deal-original-error' : undefined} data-testid="input-deal-original-price" />
                    {dealErrors.originalPriceRand && <small className="gc-field-error" id="deal-original-error">{dealErrors.originalPriceRand}</small>}
                  </div>
                </div>
                <details className="gc-more-fields">
                  <summary data-testid="button-deal-details">Add timing and image <span>Optional</span></summary>
                  <div className="gc-more-fields-body">
                    <div className="gc-field">
                      <label htmlFor="deal-image-url">Image URL</label>
                      <input id="deal-image-url" type="url" value={dealForm.imageUrl} onChange={(event) => setDealForm({ ...dealForm, imageUrl: event.target.value })} placeholder="https://" aria-invalid={!!dealErrors.imageUrl} aria-describedby={dealErrors.imageUrl ? 'deal-image-error' : undefined} data-testid="input-deal-image" />
                      {dealErrors.imageUrl && <small className="gc-field-error" id="deal-image-error">{dealErrors.imageUrl}</small>}
                    </div>
                    <div className="gc-field-row">
                      <div className="gc-field">
                        <label htmlFor="deal-start">Starts</label>
                        <input id="deal-start" type="datetime-local" value={dealForm.startsAt} onChange={(event) => setDealForm({ ...dealForm, startsAt: event.target.value })} aria-invalid={!!dealErrors.startsAt} aria-describedby={dealErrors.startsAt ? 'deal-start-error' : undefined} data-testid="input-deal-start" />
                        {dealErrors.startsAt && <small className="gc-field-error" id="deal-start-error">{dealErrors.startsAt}</small>}
                      </div>
                      <div className="gc-field">
                        <label htmlFor="deal-end">Ends</label>
                        <input id="deal-end" type="datetime-local" value={dealForm.endsAt} onChange={(event) => setDealForm({ ...dealForm, endsAt: event.target.value })} aria-invalid={!!dealErrors.endsAt} aria-describedby={dealErrors.endsAt ? 'deal-end-error' : undefined} data-testid="input-deal-end" />
                      </div>
                    </div>
                    {dealErrors.endsAt && <small className="gc-field-error" id="deal-end-error">{dealErrors.endsAt}</small>}
                  </div>
                </details>
                <label className="gc-publish-check">
                  <input type="checkbox" checked={dealForm.active} onChange={(event) => setDealForm({ ...dealForm, active: event.target.checked })} data-testid="checkbox-deal-active" />
                  <span className="gc-check-visual"><Check size={12} /></span>
                  <span><strong>Publish as soon as it’s created</strong><small>Show this offer on the public page.</small></span>
                </label>
                <button className="gc-button gc-button-primary gc-create-button" type="submit" disabled={dealPending} data-testid="button-create-deal">
                  {dealPending ? <><span className="gc-button-pulse" />Putting it together</> : <><Plus size={17} aria-hidden="true" /> Create offer</>}
                </button>
              </form>
            </section>

            <section className="gc-panel gc-deals-panel" aria-labelledby="gc-deals-title">
              <div className="gc-panel-heading gc-deals-list-heading">
                <div>
                  <p className="gc-section-index">03 / CURRENT MENU</p>
                  <h2 id="gc-deals-title">Your offers</h2>
                </div>
                <button className="gc-icon-refresh" aria-label="Refresh offers" onClick={() => void loadDeals()} disabled={dealsLoading} data-testid="button-refresh-deals">
                  <RefreshCw size={16} className={dealsLoading ? 'gc-spinning' : ''} aria-hidden="true" />
                </button>
              </div>
              {dealsError ? (
                <div className="gc-inline-error" role="alert" data-testid="status-deals-error">
                  <CircleAlert size={17} /><span>{dealsError}</span><button onClick={() => void loadDeals()} data-testid="button-retry-deals">Retry</button>
                </div>
              ) : dealsLoading && deals.length === 0 ? (
                <div className="gc-deal-skeletons" aria-label="Loading offers" aria-busy="true">{[1, 2].map((item) => <div key={item}><i /><span /><span /></div>)}</div>
              ) : deals.length === 0 ? (
                <div className="gc-deal-empty" data-testid="status-deals-empty"><Tag size={18} /><span>No offers yet. Your next special starts above.</span></div>
              ) : (
                <div className="gc-deal-list">
                  {deals.map((deal) => (
                    <article className={`gc-deal-row${deal.active ? ' is-published' : ''}`} key={deal.id} data-testid={`card-deal-${deal.id}`}>
                      <div className="gc-deal-mark" aria-hidden="true"><Tag size={15} /></div>
                      <div className="gc-deal-copy">
                        <strong data-testid={`text-deal-title-${deal.id}`}>{deal.title}</strong>
                        <span>{formatRand(deal.priceRand)}{deal.originalPriceRand ? <del>{formatRand(deal.originalPriceRand)}</del> : ''}</span>
                      </div>
                      <div className="gc-deal-publish">
                        <span className={`gc-publish-status${deal.active ? ' is-live' : ''}`} data-testid={`status-deal-${deal.id}`}>
                          <i />{deal.active ? 'Live' : 'Hidden'}
                        </span>
                        <button
                          className={`gc-toggle-button${deal.active ? ' is-on' : ''}`}
                          type="button"
                          role="switch"
                          aria-checked={deal.active}
                          aria-label={`${deal.active ? 'Unpublish' : 'Publish'} ${deal.title}`}
                          disabled={togglingDeal === deal.id}
                          onClick={() => void toggleDeal(deal)}
                          data-testid={`toggle-deal-${deal.id}`}
                        >
                          <span />
                        </button>
                      </div>
                      {togglingDeal === deal.id && <span className="gc-sr-only" role="status">Updating offer publication</span>}
                    </article>
                  ))}
                </div>
              )}
              <p className="gc-deals-footnote">Live offers appear on the Grill Craft front page.</p>
            </section>
          </aside>
        </div>

        <footer className="gc-console-footer">
          <span>GRILL CRAFT <i>—</i> (PTY) LTD.</span>
          <span>Flame-grilled chicken, made for sharing.</span>
          <span>COUNTER / 01</span>
        </footer>
      </div>
    </main>
  );
}

export default AdminPage;
