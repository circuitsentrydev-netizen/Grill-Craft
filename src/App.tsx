import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUpRight, Flame, Menu, MessageCircle, X } from 'lucide-react';

const flavours = ['Mozambican Portuguese', 'Spicy Texan', 'Sweet Moroccan'];

function App() {
  const [orderInfoOpen, setOrderInfoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedFlavour, setSelectedFlavour] = useState(flavours[0]);
  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER?.replace(/\D/g, '');

  useEffect(() => {
    if (!orderInfoOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOrderInfoOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [orderInfoOpen]);

  const handleOrder = () => {
    setMenuOpen(false);

    if (!whatsappNumber) {
      setOrderInfoOpen(true);
      return;
    }

    const message = `Hi Grill Craft, I'd like to order the Saturday Spread (R200). Flavour: ${selectedFlavour}.`;
    window.open(
      `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer',
    );
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
          <button className="header-order" onClick={handleOrder} data-testid="button-order-header">
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
                <p className="price">R200</p>
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
              <button className="poster-order" onClick={handleOrder} data-testid="button-order-saturday">
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

      <section className="closing-note" aria-labelledby="closing-title">
        <div className="closing-number">SAT<br />02</div>
        <div className="closing-copy">
          <p className="eyebrow">Bring everyone to the table</p>
          <h2 id="closing-title">The good part<br />starts <em>at the table.</em></h2>
        </div>
        <div className="closing-action">
          <p>Saturday Spread · R200</p>
          <button className="text-order" onClick={handleOrder} data-testid="button-order-footer">
            Order by Friday <ArrowUpRight size={17} aria-hidden="true" />
          </button>
        </div>
      </section>

      <footer className="site-footer">
        <a className="footer-brand" href="#top" data-testid="link-footer-home">GRILL CRAFT <span>(PTY) LTD.</span></a>
        <p>Flame-grilled chicken, made for sharing.</p>
        <span className="footer-mark" aria-hidden="true">GC—02</span>
      </footer>

      {orderInfoOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOrderInfoOpen(false);
        }}>
          <section className="order-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
            <button className="dialog-close" aria-label="Close order information" onClick={() => setOrderInfoOpen(false)} data-testid="button-close-order-info">
              <X size={19} />
            </button>
            <span className="dialog-icon"><MessageCircle size={23} /></span>
            <p className="eyebrow">A quick note before you order</p>
            <h2 id="dialog-title">We’re nearly<br /><em>ready to take orders.</em></h2>
            <p className="dialog-copy">This page needs Grill Craft’s WhatsApp number before it can open an order message. No order has been sent.</p>
            <button className="dialog-done" onClick={() => setOrderInfoOpen(false)} data-testid="button-understood">
              Got it <ArrowUpRight size={16} />
            </button>
            <p className="dialog-footnote">Saturday Spread · R200 · {selectedFlavour} · Order by Friday</p>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
