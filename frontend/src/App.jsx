import { useEffect, useState } from "react";
import "./App.css";

const BACKEND_URL = "http://localhost:8000";

function App() {
  const [gender, setGender] = useState("female");
  const [photoFile, setPhotoFile] = useState(null);
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [tryOnImageUrl, setTryOnImageUrl] = useState("");
  const [cart, setCart] = useState([]);
  const [loadingTryOn, setLoadingTryOn] = useState(false);

  // Load products & cart on start or gender change
  useEffect(() => {
    fetch(`${BACKEND_URL}/products?gender=${gender}`)
      .then((res) => res.json())
      .then(setProducts)
      .catch((err) => console.error("Error loading products:", err));

    fetch(`${BACKEND_URL}/cart`)
      .then((res) => res.json())
      .then(setCart)
      .catch((err) => console.error("Error loading cart:", err));
  }, [gender]);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    setPhotoFile(file || null);
    setTryOnImageUrl("");
  };

  const handleTryOn = async (productId) => {
    if (!photoFile) {
      alert("Please upload your photo first.");
      return;
    }
    setSelectedProductId(productId);
    setLoadingTryOn(true);
    setTryOnImageUrl("");

    const formData = new FormData();
    formData.append("person_photo", photoFile);
    formData.append("product_id", productId);
    formData.append("gender", gender);

    try {
      const res = await fetch(`${BACKEND_URL}/try-on`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.error) {
        alert(data.error);
      } else if (data.try_on_image_url) {
        setTryOnImageUrl(`${BACKEND_URL}${data.try_on_image_url}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to generate try-on image.");
    } finally {
      setLoadingTryOn(false);
    }
  };

  const handleAddToCart = async (productId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/cart/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, quantity: 1 }),
      });
      const data = await res.json();
      setCart(data);
    } catch (err) {
      console.error(err);
      alert("Failed to add to cart.");
    }
  };

  const handleClearCart = async () => {
    try {
      await fetch(`${BACKEND_URL}/cart/clear`, {
        method: "POST",
      });
      setCart([]);
    } catch (err) {
      console.error(err);
      alert("Failed to clear cart.");
    }
  };

  return (
    <div className="app-container">
      <div className="app-inner">
        <h1>Virtual Try-On (Phase 1)</h1>
        <p style={{ marginBottom: 16 }}>
          Upload your photo, choose a gender, pick a dress, and see a simple
          try-on preview.
        </p>

        {/* Upload & gender section */}
        <div className="section">
          <div className="flex-row">
            <div className="column">
              <div className="section-title">1. Your Photo</div>
              <label>
                Upload a front-facing photo:
                <input type="file" accept="image/*" onChange={handlePhotoChange} />
              </label>
              {photoFile && (
                <p style={{ fontSize: "0.9rem", marginTop: 4 }}>
                  Selected: <strong>{photoFile.name}</strong>
                </p>
              )}
            </div>

            <div className="column">
              <div className="section-title">2. Select Gender</div>
              <select
                value={gender}
                onChange={(e) => {
                  setGender(e.target.value);
                  setTryOnImageUrl("");
                  setSelectedProductId(null);
                }}
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="unisex">Unisex</option>
              </select>
              <p style={{ fontSize: "0.8rem", marginTop: 8 }}>
                Gender is used only to filter products (for now).
              </p>
            </div>
          </div>
        </div>

        {/* Product list + preview + cart */}
        <div className="flex-row">
          {/* Product List */}
          <div className="column section">
            <div className="section-title">3. Choose a Dress</div>
            {products.length === 0 && (
              <p style={{ fontSize: "0.9rem" }}>No products for this gender.</p>
            )}

            {products.map((product) => (
              <div key={product.id} className="product-card">
                <img
                  src={`${BACKEND_URL}/products/${product.image_name}`}
                  alt={product.name}
                  className="product-thumb"
                  onError={(e) => {
                    e.target.style.visibility = "hidden";
                  }}
                />
                <div className="product-info">
                  <div className="product-name">{product.name}</div>
                  <div className="product-price">
                    ₹ {product.price.toLocaleString("en-IN")}
                  </div>
                  <span className="tag">{product.gender}</span>
                  <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                    <button
                      className="btn-secondary"
                      onClick={() => handleTryOn(product.id)}
                      disabled={loadingTryOn && selectedProductId === product.id}
                    >
                      {loadingTryOn && selectedProductId === product.id
                        ? "Trying..."
                        : "Try On"}
                    </button>
                    <button
                      className="btn-primary"
                      onClick={() => handleAddToCart(product.id)}
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Preview */}
          <div className="column section">
            <div className="section-title">4. Try-On Preview</div>
            {!tryOnImageUrl && (
              <p style={{ fontSize: "0.9rem" }}>
                After you upload a photo and click <b>Try On</b>, the preview will
                appear here.
              </p>
            )}
            {tryOnImageUrl && (
              <img
                src={tryOnImageUrl}
                alt="Try on result"
                className="preview-image"
              />
            )}
          </div>

          {/* Cart */}
          <div className="column section">
            <div className="section-title">5. Cart</div>
            {cart.length === 0 && (
              <p style={{ fontSize: "0.9rem" }}>Your cart is empty.</p>
            )}

            {cart.map((item) => {
              const product = products.find((p) => p.id === item.product_id)
                || { name: `Product #${item.product_id}`, price: 0 };

              return (
                <div key={item.product_id} className="cart-item">
                  <span>
                    {product.name} × {item.quantity}
                  </span>
                  <span>₹ {(product.price * item.quantity).toLocaleString("en-IN")}</span>
                </div>
              );
            })}

            {cart.length > 0 && (
              <>
                <hr style={{ margin: "8px 0" }} />
                <button className="btn-danger" onClick={handleClearCart}>
                  Clear Cart
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
