import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUpRight, Check, Flame, LoaderCircle, Menu, MessageCircle, X } from 'lucide-react';
import { Route, Switch } from 'wouter';
import AdminPage from '@/pages/admin';
import NotFound from '@/pages/not-found';
import { apiRequest } from '@/lib/api';

const flavours = ['Mozambican Peri-Peri', 'Moroccan'];

type Deal = {
  id: string;
  title: string;
  description: string;
  priceRand: number;
  originalPriceRand: number | null;
  imageUrl: string | null;
};

type OrderResponse = {
  order: {
    id: string;
    totalRand: number;
  };
};

type OrderOffer = {
  id: string | null;
  title: string;
  priceRand: number;
};

function PublicSite() {
  const [orderInfoOpen, setOrderInfoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedFlavour, setSelectedFlavour] = useState(flavours[0]);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'whatsapp' | 'cash' | 'eft' | 'yoco'>('whatsapp');
  const [orderError, setOrderError] = useState('');
  const [submittedOrder, setSubmittedOrder] = useState<OrderResponse['order'] | null>(null);
  const [orderOffer, setOrderOffer] = useState<OrderOffer>({
    id: null,
    title: 'Saturday Spread',
    priceRand: 220,
  });
  const [orderForm, setOrderForm] = useState({
    customerName: '',
    phone: '',
    quantity: '1',
    notes: '',
    sauceOption: 'none',
  });
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dealsError, setDealsError] = useState('');
  const [dealsLoading, setDealsLoading] = useState(true);

  useEffect(() => {
    if (!orderInfoOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOrderInfoOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [orderInfoOpen]);

  useEffect(() => {
    let active = true;
    apiRequest<{ deals: Deal[] }>('/api/deals')
      .then((result) => {
        if (active) setDeals(result.deals);
      })
      .catch((error: unknown) => {
        if (active) {
          setDealsError(error instanceof Error ? error.message : 'Specials could not be loaded.');
        }
      })
      .finally(() => {
        if (active) setDealsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleWholeChicken = () => {
    setMenuOpen(false);
    setSubmittedOrder(null);
    setOrderError('');
    setOrderOffer({ id: null, title: 'Whole Chicken', priceRand: 170 });
    setOrderInfoOpen(true);
  };

  const handleOrder = (deal?: Deal) => {
    setMenuOpen(false);
    setSubmittedOrder(null);
    setOrderError('');
    setOrderOffer(
      deal
        ? { id: deal.id, title: deal.title, priceRand: deal.priceRand }
        : { id: null, title: 'Saturday Spread', priceRand: 220 },
    );
    setOrderInfoOpen(true);
  };

  const startYocoPayment = async (orderId: string) => {
    const checkout = await apiRequest<{ checkoutUrl: string }>('/api/payments/create', {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    });
    window.location.assign(checkout.checkoutUrl);
  };

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOrderSubmitting(true);
    setOrderError('');

    try {
      const result = await apiRequest<OrderResponse>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerName: orderForm.customerName,
          phone: orderForm.phone,
          flavour: selectedFlavour,
          quantity: Number(orderForm.quantity),
          notes: orderForm.notes,
          dealId: orderOffer.id,
          sauceOption: orderForm.sauceOption,
          itemType: orderOffer.title === 'Whole Chicken' ? 'whole_chicken' : 'saturday_spread',
        }),
      });
      setSubmittedOrder(result.order);
      if (paymentMethod === 'yoco') {
        try {
          await startYocoPayment(result.order.id);
        } catch (paymentError) {
          setOrderError(paymentError instanceof Error ? paymentError.message : 'Your order was saved, but Yoco checkout is not available yet. Please use WhatsApp, cash or EFT.');
        }
      }
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : 'Your order could not be placed. Please try again.');
    } finally {
      setOrderSubmitting(false);
    }
  };

  return (
    <main className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Grill Craft home" data-testid="link-home">
          <span className="brand-mark"><Flame aria-hidden="true" /></span>
          <span className="brand-type">
            <strong>GRILL CRAFT</strong>
            <small>(PTY) LTD.</small>
          </span>
        </a>
        <nav className={`header-nav${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
          <a href="#spread" onClick={() => setMenuOpen(false)}>The Saturday Spread</a>
          <a href="/track" onClick={() => setMenuOpen(false)}>Track order</a>
          <button className="header-order" onClick={() => handleOrder()} data-testid="button-order-header">
            Order now <ArrowUpRight size={16} aria-hidden="true" />
          </button>
        </nav>
        <button
          className="mobile-menu-toggle"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          data-testid="button-mobile-menu"
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      <section className="hero" id="top" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-line" /> Flame-grilled, the Grill Craft way</p>
          <h1 id="hero-title">Make room<br />for <em>Saturday.</em></h1>
          <p className="hero-intro">A proper flame-grilled chicken spread, made for passing around the table.</p>
          <a href="#spread" className="discover-link" data-testid="link-discover-spread">
            Meet the Saturday Spread <ArrowDown size={15} aria-hidden="true" />
          </a>
          <div className="hero-stamp" aria-hidden="true">
            <span>FIRE</span><Flame /><span>FLAVOUR</span>
          </div>
        </div>

        <div className="poster-wrap" id="spread">
          <article className="menu-poster" aria-label="The Saturday Spread special">
            <div className="poster-grain" aria-hidden="true" />
            <aside className="poster-index">
              <span className="index-number">02</span>
              <span className="index-day">SATURDAY</span>
            </aside>
            <div className="poster-content">
              <p className="poster-kicker">THE SATURDAY SPREAD</p>
              <h2 id="poster-title">TWO HALVES.<br /><span>FULL-ON FEAST.</span></h2>
              <p className="poster-description">Two half chickens, sides &amp; rotis: homemade coleslaw, medium chips and four rotis.</p>
              <div className="price-block">
                <p className="price">R220</p>
                <p className="price-caption">Choose your fire-kissed flavour</p>
              </div>
              <ul className="flavour-list" aria-label="Choose a flavour">
                {flavours.map((flavour) => (
                  <li key={flavour}>
                    <button
                      className="flavour-choice"
                      type="button"
                      aria-pressed={selectedFlavour === flavour}
                      onClick={() => setSelectedFlavour(flavour)}
                    >
                      {flavour}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="order-deadline">ORDER BY FRIDAY</p>
              <button className="poster-order" onClick={() => handleOrder()} data-testid="button-order-saturday">
                <MessageCircle size={21} aria-hidden="true" />
                <span>Order Saturday’s</span>
                <ArrowUpRight size={19} aria-hidden="true" />
              </button>
            </div>
            <div className="poster-seal" aria-hidden="true"><span>GRILL<br />CRAFT</span><Flame /></div>
          </article>
          <p className="poster-caption"><span>01 / 01</span> A Saturday worth slowing down for.</p>
        </div>
        <div className="hero-rule" aria-hidden="true"><span /></div>
      </section>

      <section className="deals-section" aria-labelledby="deals-title">
        <div className="deals-heading">
          <div>
            <p className="eyebrow">From the grill, for a limited time</p>
            <h2 id="deals-title">This week’s <em>deals.</em></h2>
          </div>
          <span className="deals-count">{deals.length.toString().padStart(2, '0')} / LIVE</span>
        </div>
        {dealsLoading && <p className="deals-message" role="status">Checking this week’s specials…</p>}
        {!dealsLoading && dealsError && (
          <p className="deals-message deals-error" role="status">{dealsError}</p>
        )}
        {!dealsLoading && !dealsError && deals.length === 0 && (
          <p className="deals-message">No extra deals this week. The Saturday Spread is ready below.</p>
        )}
        {!dealsLoading && !dealsError && deals.length > 0 && (
          <div className="deals-grid">
            {deals.map((deal) => (
              <article className="deal-card" key={deal.id} data-testid={`card-deal-${deal.id}`}>
                {deal.imageUrl ? (
                  <img className="deal-image" src={deal.imageUrl} alt="" loading="lazy" />
                ) : (
                  <div className="deal-image deal-image-placeholder" aria-hidden="true"><Flame /></div>
                )}
                <div className="deal-copy">
                  <p className="deal-label">GRILL CRAFT SPECIAL</p>
                  <h3>{deal.title}</h3>
                  <p className="deal-description">{deal.description}</p>
                  <p className="deal-price">
                    <strong>R{deal.priceRand.toFixed(0)}</strong>
                    {deal.originalPriceRand !== null && (
                      <del>R{deal.originalPriceRand.toFixed(0)}</del>
                    )}
                  </p>
                  <button className="deal-order" onClick={() => handleOrder(deal)} data-testid={`button-order-deal-${deal.id}`}>
                    Order this deal <ArrowUpRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="closing-note" aria-labelledby="closing-title">
        <div className="closing-number">SAT<br />02</div>
        <div className="closing-copy">
          <p className="eyebrow">Bring everyone to the table</p>
          <h2 id="closing-title">The good part<br />starts <em>at the table.</em></h2>
        </div>
        <div className="closing-action">
          <p>Saturday Spread · R220</p>
          <button className="text-order" onClick={() => handleOrder()} data-testid="button-order-footer">
            Order by Friday <ArrowUpRight size={17} aria-hidden="true" />
          </button>
          <button className="text-order" onClick={handleWholeChicken} data-testid="button-order-whole-chicken">
            Whole chicken · R170 <ArrowUpRight size={17} aria-hidden="true" />
          </button>
        </div>
      </section>

      <footer className="site-footer">
        <a className="footer-brand" href="#top" data-testid="link-footer-home">GRILL CRAFT <span>(PTY) LTD.</span></a>
        <p>Flame-grilled chicken, made for sharing.</p>
        <div className="footer-utility">
          <a className="footer-admin" href="/track">Track order</a>
          <a className="footer-admin" href="/admin" data-testid="link-admin">Admin</a>
          <span className="footer-mark" aria-hidden="true">GC—02</span>
        </div>
      </footer>

      {orderInfoOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOrderInfoOpen(false);
        }}>
          <section className="order-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
            <button className="dialog-close" aria-label="Close order information" onClick={() => setOrderInfoOpen(false)} data-testid="button-close-order-info">
              <X size={19} />
            </button>
            {submittedOrder ? (
              <div className="order-success" role="status">
                <span className="dialog-icon"><Check size={23} /></span>
                <p className="eyebrow">Order received</p>
                <h2 id="dialog-title">You’re on<br /><em>the list.</em></h2>
                <p className="dialog-copy">
                  Order {submittedOrder.id.slice(0, 8).toUpperCase()} is saved. Grill Craft will contact you to confirm the details.
                </p>
                <p className="dialog-footnote">Estimated total · R{submittedOrder.totalRand.toFixed(0)}</p>
                {orderError && <p className="form-error" role="alert">{orderError}</p>}
                <p className="dialog-footnote">Payment choice: {paymentMethod === 'eft' ? 'EFT / pay-to-account — request verified account details on WhatsApp.' : paymentMethod === 'cash' ? 'Cash — pay when collecting or receiving your order.' : paymentMethod === 'yoco' ? 'Yoco online checkout.' : 'WhatsApp — confirm your order directly with Fred.'}</p>
                <a className="dialog-done" target="_blank" rel="noreferrer" href={`https://wa.me/${(import.meta.env.VITE_WHATSAPP_NUMBER || '27718718052').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello Grill Craft, I have placed order ${submittedOrder.id.slice(0, 8).toUpperCase()} for ${orderForm.quantity} x ${orderOffer.title}. Flavour: ${selectedFlavour}. Total: R${submittedOrder.totalRand.toFixed(2)}. Payment: ${paymentMethod.toUpperCase()}. Name: ${orderForm.customerName}. Please confirm my order.`)}`}> <MessageCircle size={16} /> Send order to WhatsApp <ArrowUpRight size={16} /></a>
                <a className="text-order" href={'/track?order=' + encodeURIComponent(submittedOrder.id)}>Track this order</a>
                <button className="dialog-done" onClick={() => setOrderInfoOpen(false)} data-testid="button-close-order-success">
                  Done <ArrowUpRight size={16} />
                </button>
              </div>
            ) : (
              <>
                <span className="dialog-icon"><MessageCircle size={23} /></span>
                <p className="eyebrow">{orderOffer.id ? 'ORDER THIS SPECIAL' : 'ORDER THE SATURDAY SPREAD'}</p>
                <h2 id="dialog-title">Let’s get<br /><em>your order in.</em></h2>
                <p className="dialog-copy">
                  {orderOffer.id ? orderOffer.title : 'Two half chickens, sides and four rotis'} · R{orderOffer.priceRand.toFixed(0)} each.
                </p>
                <form className="order-form" onSubmit={submitOrder}>
                  <label>
                    Your name
                    <input
                      required
                      maxLength={100}
                      autoComplete="name"
                      value={orderForm.customerName}
                      onChange={(event) => setOrderForm({ ...orderForm, customerName: event.target.value })}
                      data-testid="input-order-name"
                    />
                  </label>
                  <label>
                    Mobile number
                    <input
                      required
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      maxLength={32}
                      value={orderForm.phone}
                      onChange={(event) => setOrderForm({ ...orderForm, phone: event.target.value })}
                      data-testid="input-order-phone"
                    />
                  </label>
                  <div className="order-form-row">
                    <label>
                      Quantity
                      <input
                        required
                        type="number"
                        min="1"
                        max="20"
                        step="1"
                        value={orderForm.quantity}
                        onChange={(event) => setOrderForm({ ...orderForm, quantity: event.target.value })}
                        data-testid="input-order-quantity"
                      />
                    </label>
                    <label>
                      Flavour
                      <select
                        value={selectedFlavour}
                        onChange={(event) => setSelectedFlavour(event.target.value)}
                        data-testid="select-order-flavour"
                      >
                        {flavours.map((flavour) => <option key={flavour}>{flavour}</option>)}
                      </select>
                    </label>
                  </div>
                  <label className="sauce-option">
                    <span>How would you like to order / pay?</span>
                    <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}>
                      <option value="whatsapp">WhatsApp order — confirm with Fred</option>
                      <option value="cash">Cash on collection / delivery</option>
                      <option value="eft">EFT / pay-to-account — request details on WhatsApp</option>
                      <option value="yoco">Pay online with Yoco</option>
                    </select>
                  </label>
                  <label className="sauce-option">
                    <span>Smothered-in-sauce dipping</span>
                    <select value={orderForm.sauceOption} onChange={(event) => setOrderForm({ ...orderForm, sauceOption: event.target.value })}>
                      <option value="none">No extra sauce</option>
                      <option value="smothered">Add smothered sauce for dipping</option>
                    </select>
                  </label>
                  <label>
                    Notes <span className="optional-label">Optional</span>
                    <textarea
                      maxLength={1000}
                      rows={2}
                      value={orderForm.notes}
                      onChange={(event) => setOrderForm({ ...orderForm, notes: event.target.value })}
                      data-testid="input-order-notes"
                    />
                  </label>
                  {paymentMethod === 'eft' && <p className="dialog-footnote">We’ll share the business’s verified bank details directly. Your order is only marked paid after the payment reflects.</p>}
                  {paymentMethod === 'yoco' && <p className="dialog-footnote">Yoco online checkout will work once the merchant’s live API access is approved and configured.</p>}
                  {orderError && <p className="form-error" role="alert">{orderError}</p>}
                  <button className="dialog-done order-submit" type="submit" disabled={orderSubmitting} data-testid="button-submit-order">
                    {orderSubmitting ? <LoaderCircle size={17} className="spin" /> : <MessageCircle size={17} />}
                    {orderSubmitting ? 'Sending order…' : `Place order · R${(Math.max(1, Number(orderForm.quantity) || 1) * orderOffer.priceRand).toFixed(0)}`}
                    {!orderSubmitting && <ArrowUpRight size={16} />}
                  </button>
                </form>
                <p className="dialog-footnote">
                  {orderOffer.id ? 'We’ll contact you to confirm your order' : 'Order by Friday · We’ll contact you to confirm'}
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}


function TrackPage() {
  const [orderId, setOrderId] = useState(new URLSearchParams(window.location.search).get('order') || '');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState<{ id: string; itemName: string; flavour: string; quantity: number; totalRand: number; status: string; paymentStatus: string; sauceOption: string; createdAt: string } | null>(null);
  const [events, setEvents] = useState<{ event_type: string; message: string; created_at: string }[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const lastKnownOrder = useRef<{ status: string; paymentStatus: string } | null>(null);

  const loadOrder = async (silent = false) => {
    if (!orderId.trim() || !phone.trim()) return;
    if (!silent) setLoading(true);
    try {
      const result = await apiRequest<{ order: NonNullable<typeof order>; events: typeof events }>(
        '/api/orders/track?id=' + encodeURIComponent(orderId.trim()) + '&phone=' + encodeURIComponent(phone.trim())
      );
      const previous = lastKnownOrder.current;
      if (previous && (result.order.status !== previous.status || result.order.paymentStatus !== previous.paymentStatus) && notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
        const message = result.order.status !== previous.status
          ? 'Your order is now ' + result.order.status + '.'
          : 'Your payment is now ' + result.order.paymentStatus + '.';
        new Notification('Grill Craft order update', { body: message });
      }
      lastKnownOrder.current = { status: result.order.status, paymentStatus: result.order.paymentStatus };
      setOrder(result.order);
      setEvents(result.events);
      setError('');
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : 'Order could not be found.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!order || !phone) return;
    const timer = window.setInterval(() => void loadOrder(true), 12000);
    return () => window.clearInterval(timer);
  }, [order?.id, phone, notificationsEnabled]);

  const enableNotifications = async () => {
    if (!('Notification' in window)) {
      setError('This browser does not support notifications.');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === 'granted');
    if (permission !== 'granted') setError('Notifications were not enabled. Keep this page open to refresh your tracking manually.');
  };

  return (
    <main className="site-shell tracking-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Grill Craft home"><span className="brand-mark"><Flame /></span><span className="brand-type"><strong>GRILL CRAFT</strong><small>(PTY) LTD.</small></span></a>
        <nav className="header-nav"><a href="/">Home</a><a href="/#spread">Menu</a></nav>
      </header>
      <section className="tracking-page">
        <p className="eyebrow">YOUR GRILL CRAFT ORDER</p>
        <h1>Track your <em>order.</em></h1>
        <p className="dialog-copy">Enter the order reference and the mobile number used at checkout.</p>
        <form className="order-form tracking-form" onSubmit={(event) => { event.preventDefault(); void loadOrder(); }}>
          <label>Order reference<input required value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="Paste your order reference" /></label>
          <label>Mobile number<input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Your order mobile number" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="dialog-done" type="submit" disabled={loading}>{loading ? 'Checking…' : 'Find my order'} <ArrowUpRight size={16} /></button>
        </form>
        {order && <section className="tracking-result" aria-live="polite">
          <div className="tracking-result-head"><div><p className="eyebrow">ORDER {order.id.slice(0, 8).toUpperCase()}</p><h2>{order.status.replaceAll('_', ' ')}</h2></div><span className="tracking-status">{order.paymentStatus.replaceAll('_', ' ')}</span></div>
          <p>{order.itemName} · {order.flavour} · Qty {order.quantity}</p>
          <p>{order.sauceOption === 'smothered' ? 'Smothered sauce for dipping' : 'No extra dipping sauce'}</p>
          <p className="tracking-total">Total · R{order.totalRand.toFixed(2)}</p>
          <button className="text-order" type="button" onClick={enableNotifications}>Enable order notifications</button>
          <p className="dialog-footnote">This page checks for updates every 12 seconds while it remains open. Browser notifications require your permission.</p>
          <h3>Order updates</h3>
          <ol className="tracking-events">{events.map((event, index) => <li key={event.event_type + event.created_at + index}><strong>{event.message}</strong><time>{new Date(event.created_at).toLocaleString('en-ZA')}</time></li>)}</ol>
        </section>}
      </section>
      <footer className="site-footer"><a className="footer-brand" href="/">GRILL CRAFT <span>(PTY) LTD.</span></a><p>Flame-grilled chicken, made for sharing.</p><div className="footer-utility"><a href="/admin">Admin</a></div></footer>
    </main>
  );
}

function App() {
  return (
    <Switch>
      <Route path="/" component={PublicSite} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/track" component={TrackPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default App;
