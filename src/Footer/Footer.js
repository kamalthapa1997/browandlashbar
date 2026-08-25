import "./Footer.css";

function Footer() {
  return (
    <footer className="site-footer">
      <p className="site-footer__copyright">
        © {new Date().getFullYear()} Mero Brow &amp; Lash Bar
      </p>

      <p className="site-footer__tagline">
        Beautifully considered beauty care.
      </p>
    </footer>
  );
}

export default Footer;
