"use client";

import React, { useMemo, useState } from "react";

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  wasPrice?: number;
  promo?: string;
  onSale?: boolean;
  stock: number;
};

type Buyer = {
  name: string;
  mobile: string;
  verified: boolean;
};

const productsSeed: Product[] = [
  { id: 1, name: "Bananas", category: "Fruits", price: 1.2, wasPrice: 1.5, promo: "Fresh Deal", onSale: true, stock: 20 },
  { id: 2, name: "Tomatoes", category: "Vegetables", price: 1.2, wasPrice: 1.2, promo: "4 for 3", onSale: true, stock: 40 },
  { id: 3, name: "Milk", category: "Confectionery", price: 1.1, stock: 30 },
  { id: 4, name: "Potato Chips", category: "Confectionery", price: 3.0, promo: "BOGO", onSale: true, stock: 16 },
  { id: 5, name: "Basmati Rice", category: "Rice", price: 4.5, wasPrice: 5.0, promo: "Family Saver", onSale: true, stock: 18 },
  { id: 6, name: "Atta Flour", category: "Flour", price: 3.2, stock: 22 },
  { id: 7, name: "Sunflower Oil", category: "Oil", price: 6.8, stock: 14 },
  { id: 8, name: "Red Lentils", category: "Lentils", price: 2.4, stock: 26 },
  { id: 9, name: "Turmeric Powder", category: "Spices", price: 1.9, stock: 35 },
  { id: 10, name: "Frozen Peas", category: "Frozen Item", price: 2.1, stock: 12 },
];

export default function GroceryUATReadyApp() {
  const [route, setRoute] = useState<"store" | "sale" | "buyer" | "admin" | "checkout">("store");
  const [products] = useState(productsSeed);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [sortBy, setSortBy] = useState<string>("default");
  const [productsExpanded, setProductsExpanded] = useState(false);
  const [cart, setCart] = useState<(Product & { qty: number })[]>([]);
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryComment, setDeliveryComment] = useState("");
  const [adminLogged, setAdminLogged] = useState(false);
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminOtp, setAdminOtp] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<Record<string, string[]>>({});
  const [savedInstructions, setSavedInstructions] = useState<Record<string, string[]>>({});
  const [orderHistory, setOrderHistory] = useState<Record<string, { total: number; items: string; address: string }[]>>({});
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [paymentOtpSent, setPaymentOtpSent] = useState(false);
  const [paymentOtp, setPaymentOtp] = useState("");
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [adminProducts] = useState(productsSeed);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [editingProductId, setEditingProductId] = useState<number | null>(null);

  const visible = useMemo(() => {
    let list = route === "sale" ? products.filter((p) => p.onSale) : products;

    if (selectedCategory !== "All") {
      list = list.filter((p) => p.category.toLowerCase() === selectedCategory.toLowerCase());
    }

    if (query.trim()) {
      list = list.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
    }

    if (sortBy === "priceLowHigh") {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (sortBy === "priceHighLow") {
      list = [...list].sort((a, b) => b.price - a.price);
    } else if (sortBy === "nameAZ") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "saleOnly") {
      list = list.filter((p) => p.onSale);
    }

    return list;
  }, [route, products, query, selectedCategory, sortBy]);

  const addToCart = (p: Product) => {
    const increment = p.promo === "BOGO" ? 2 : 1;

    setCart((prev) => {
      const found = prev.find((x) => x.id === p.id);
      const qty = found ? found.qty : 0;

      if (qty + increment > p.stock) {
        setMessage("Stock exceeded");
        return prev;
      }

      if (found) {
        return prev.map((x) =>
          x.id === p.id ? { ...x, qty: x.qty + increment } : x
        );
      }

      return [...prev, { ...p, qty: increment }];
    });
  };

  const decreaseQty = (productId: number) => {
    setCart((prev) =>
      prev
        .map((x) => (x.id === productId ? { ...x, qty: x.qty - 1 } : x))
        .filter((x) => x.qty > 0)
    );
  };

  const getLineTotal = (item: Product & { qty: number }) => {
    if (item.promo === "BOGO") {
      const payableQty = Math.ceil(item.qty / 2);
      return payableQty * item.price;
    }
    if (item.promo === "4 for 3") {
      const bundles = Math.floor(item.qty / 4);
      const remainder = item.qty % 4;
      return bundles * (3 * item.price) + remainder * item.price;
    }
    return item.qty * item.price;
  };

  const getLineSavings = (item: Product & { qty: number }) => {
    if (item.promo === "BOGO") {
      return Math.floor(item.qty / 2) * item.price;
    }
    if (item.promo === "4 for 3") {
      return Math.floor(item.qty / 4) * item.price;
    }
    if (item.wasPrice && item.wasPrice > item.price) {
      return item.qty * (item.wasPrice - item.price);
    }
    return 0;
  };

  const subtotal = cart.reduce((s, x) => s + getLineTotal(x), 0);
  const totalSavings = cart.reduce((s, x) => s + getLineSavings(x), 0);

  const registerOrLoginBuyer = () => {
    if (!mobile) {
      setMessage("Enter mobile");
      return;
    }

    if (!buyer) {
      if (!name) {
        setMessage("Enter name for first registration");
        return;
      }
      setOtpSent(true);
      setMessage("OTP sent: use 123456");
      return;
    }

    if (buyer.mobile === mobile) {
      setMessage(`Welcome back ${buyer.name}`);
      setRoute("store");
    } else {
      setMessage("Mobile number does not match registered buyer");
    }
  };

  const verifyOtp = () => {
    if (otp !== "123456") {
      setMessage("Invalid OTP");
      return;
    }

    const newBuyer: Buyer = {
      name,
      mobile,
      verified: true,
    };

    setBuyer(newBuyer);
    setOtpSent(false);
    setOtp("");
    setMessage(`Buyer ${name} verified successfully`);
    setRoute("store");
  };

  const Btn = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        background: "#2563eb",
        color: "white",
        border: 0,
        cursor: "pointer",
        marginBottom: 10,
        width: "100%",
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "220px 1fr 300px",
        background: "#0b132b",
        color: "white",
      }}
    >
      <aside style={{ padding: 20, borderRight: "1px solid #334155" }}>
        <h3>🛒 Grocery OS</h3>

        <Btn
          label={productsExpanded ? "Products ▼" : "Products ▶"}
          onClick={() => setProductsExpanded((v) => !v)}
        />

        {productsExpanded && (
          <div style={{ margin: "6px 0 14px 0", display: "grid", gap: 6 }}>
            {[
              "Flour",
              "Rice",
              "Vegetables",
              "Spices",
              "Oil",
              "Lentils",
              "Fruits",
              "Confectionery",
              "Frozen Item",
              "Sweets",
              "Snacks",
            ].map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setRoute("store");
                  setSelectedCategory(cat);
                }}
                style={{
                  textAlign: "left",
                  background: selectedCategory === cat ? "#1d4ed8" : "transparent",
                  color: "#cbd5e1",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  padding: "8px 10px",
                  cursor: "pointer",
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <Btn label="Sale" onClick={() => setRoute("sale")} />
        <Btn
          label={buyer ? `Buyer: ${buyer.name}` : "Buyer Login"}
          onClick={() => setRoute("buyer")}
        />
        <Btn
          label={adminLogged ? "Admin Logged In" : "Admin Login"}
          onClick={() => setRoute("admin")}
        />
      </aside>

      <main style={{ padding: 24 }}>
        {message && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              border: "1px solid #334155",
              borderRadius: 10,
            }}
          >
            {message}
          </div>
        )}

        {(route === "store" || route === "sale") && (
          <>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products"
                style={{ flex: 1, padding: 12, borderRadius: 10 }}
              />
              <button
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "#2563eb",
                  color: "white",
                  border: 0,
                }}
              >
                Search
              </button>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ padding: 12, borderRadius: 10 }}
              >
                <option value="default">Sort</option>
                <option value="priceLowHigh">Price: Low to High</option>
                <option value="priceHighLow">Price: High to Low</option>
                <option value="nameAZ">Name: A-Z</option>
                <option value="saleOnly">Sale Only</option>
              </select>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 16,
              }}
            >
              {visible.map((p) => (
                <div
                  key={p.id}
                  style={{
                    border: "1px solid #334155",
                    borderRadius: 12,
                    padding: 10,
                  }}
                >
                  <div
                    style={{
                      height: 84,
                      borderRadius: 10,
                      background: "#1e293b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 12,
                      color: "#94a3b8",
                    }}
                  >
                    Product Image
                  </div>

                  <h3>{p.name}</h3>
                  <div>{p.category}</div>
                  <div>Stock: {p.stock}</div>

                  <div>
                    {!(p.promo === "BOGO" || p.promo === "4 for 3") &&
                      p.wasPrice && (
                        <span
                          style={{
                            textDecoration: "line-through",
                            marginRight: 8,
                          }}
                        >
                          £{p.wasPrice.toFixed(2)}
                        </span>
                      )}
                    <strong>£{p.price.toFixed(2)}</strong>
                  </div>

                  {p.promo && <div style={{ color: "#86efac" }}>{p.promo}</div>}
                  {p.promo === "BOGO" && (
                    <div style={{ fontSize: 12, color: "#93c5fd" }}>
                      Buy 1, get 1 free (charged as 1 of every 2)
                    </div>
                  )}
                  {p.promo === "4 for 3" && (
                    <div style={{ fontSize: 12, color: "#93c5fd" }}>
                      Every 4th item is free
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <button
                      onClick={() => decreaseQty(p.id)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "#334155",
                        color: "white",
                        border: 0,
                        cursor: "pointer",
                      }}
                    >
                      −
                    </button>

                    <Btn label="Add to Cart" onClick={() => addToCart(p)} />

                    <span>In cart: {cart.find((x) => x.id === p.id)?.qty || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {route === "admin" && (
          <div style={{ maxWidth: 720 }}>
            <h2>Admin Secure Login</h2>

            {!adminLogged ? (
              <>
                <input
                  value={adminUser}
                  onChange={(e) => setAdminUser(e.target.value)}
                  placeholder="Admin User ID"
                  style={{
                    display: "block",
                    padding: 12,
                    marginBottom: 12,
                    width: 420,
                  }}
                />
                <input
                  type="password"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  placeholder="Password"
                  style={{
                    display: "block",
                    padding: 12,
                    marginBottom: 12,
                    width: 420,
                  }}
                />
                <input
                  value={adminOtp}
                  onChange={(e) => setAdminOtp(e.target.value)}
                  placeholder="OTP (123456)"
                  style={{
                    display: "block",
                    padding: 12,
                    marginBottom: 12,
                    width: 420,
                  }}
                />

                <Btn
                  label="Login Admin"
                  onClick={() => {
                    if (adminUser && adminPass && adminOtp === "123456") {
                      setAdminLogged(true);
                      setMessage("Admin authenticated successfully");
                    } else {
                      setMessage("Invalid admin credentials or OTP");
                    }
                  }}
                />
              </>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>Admin logged in.</div>

                <div
                  style={{
                    marginTop: 20,
                    display: "grid",
                    gap: 16,
                  }}
                >
                  <div
                    style={{
                      padding: 16,
                      border: "1px solid #334155",
                      borderRadius: 12,
                      background: "#111827",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        marginBottom: 12,
                      }}
                    >
                      Seller Control Tower
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, minmax(0,1fr))",
                        gap: 12,
                        marginBottom: 20,
                      }}
                    >
                      {[
                        "Catalog",
                        "Add Product",
                        "Inventory Update",
                        "Promo Engine",
                        "Orders",
                        "Customers",
                        "Alerts",
                        "Analytics",
                      ].map((x) => (
                        <button
                          key={x}
                          onClick={() => {
                            if (x === "Catalog") {
                              setMessage("Catalog dashboard opened");
                            } else if (x === "Add Product") {
                              setMessage("Add Product workflow launched");
                            } else if (x === "Inventory Update") {
                              setMessage("Inventory update panel opened");
                            } else if (x === "Promo Engine") {
                              setMessage("Promotion engine opened");
                            } else if (x === "Orders") {
                              setMessage("Orders dashboard opened");
                            }
                          }}
                          style={{
                            padding: 12,
                            borderRadius: 10,
                            background: "#2563eb",
                            color: "white",
                            border: 0,
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                        >
                          {x}
                        </button>
                      ))}
                    </div>

                    <div
                      style={{
                        padding: 16,
                        border: "1px solid #334155",
                        borderRadius: 12,
                      }}
                    >
                      <h3 style={{ marginBottom: 12 }}>Catalog & Product Management</h3>

                      <input
                        value={catalogSearch}
                        onChange={(e) => setCatalogSearch(e.target.value)}
                        placeholder="Search SKU / product / category"
                        style={{
                          width: "100%",
                          padding: 10,
                          borderRadius: 8,
                          marginBottom: 12,
                        }}
                      />

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, minmax(0,1fr))",
                          gap: 10,
                        }}
                      >
                        {adminProducts
                          .filter((p) => {
                            if (!catalogSearch.trim()) return true;
                            const q = catalogSearch.toLowerCase();
                            return (
                              p.name.toLowerCase().includes(q) ||
                              p.category.toLowerCase().includes(q) ||
                              String(p.id).includes(q)
                            );
                          })
                          .slice(0, 6)
                          .map((p) => (
                            <div
                              key={p.id}
                              style={{
                                padding: 12,
                                border: "1px solid #334155",
                                borderRadius: 10,
                              }}
                            >
                              <div>
                                <strong>{p.name}</strong>
                              </div>
                              <div>{p.category}</div>
                              <div>
                                £{p.price.toFixed(2)} · Stock {p.stock}
                              </div>
                              <button
                                onClick={() => setEditingProductId(p.id)}
                                style={{
                                  marginTop: 8,
                                  padding: "6px 10px",
                                  borderRadius: 8,
                                  background: "#2563eb",
                                  color: "white",
                                  border: 0,
                                }}
                              >
                                {editingProductId === p.id ? "Editing..." : "Edit Product"}
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {route === "checkout" && (
          <div style={{ maxWidth: 640 }}>
            <h2>Checkout</h2>

            <p style={{ color: "#93c5fd", marginBottom: 8 }}>
              {buyer?.mobile && orderHistory[buyer.mobile]?.length
                ? `Previous orders: ${orderHistory[buyer.mobile].length}`
                : "First order"}
            </p>

            {buyer?.mobile && orderHistory[buyer.mobile]?.length ? (
              <button
                onClick={() => {
                  const last =
                    orderHistory[buyer.mobile][orderHistory[buyer.mobile].length - 1];

                  const rebuilt = last.items
                    .split(", ")
                    .map((entry) => {
                      const [namePart, qtyPart] = entry.split(" x");
                      const product = products.find((p) => p.name === namePart);
                      return product ? { ...product, qty: Number(qtyPart) } : null;
                    })
                    .filter(Boolean) as (Product & { qty: number })[];

                  setCart(rebuilt);
                  setDeliveryAddress(last.address);
                  setMessage("Last basket restored successfully");
                }}
                style={{
                  marginBottom: 12,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "#0ea5e9",
                  color: "white",
                  border: 0,
                  cursor: "pointer",
                }}
              >
                Reorder Last Basket
              </button>
            ) : null}

            <p style={{ color: "#94a3b8", marginBottom: 16 }}>
              Enter delivery details before payment.
            </p>

            {buyer?.mobile && (savedAddresses[buyer.mobile]?.length ?? 0) > 0 && (
              <select
                onChange={(e) => setDeliveryAddress(e.target.value)}
                style={{
                  display: "block",
                  padding: 12,
                  marginBottom: 12,
                  width: "100%",
                  borderRadius: 10,
                }}
              >
                <option value="">Use previously used address</option>
                {savedAddresses[buyer.mobile].map((addr, i) => (
                  <option key={i} value={addr}>
                    {addr}
                  </option>
                ))}
              </select>
            )}

            <input
              value={checkoutPhone}
              onChange={(e) => setCheckoutPhone(e.target.value)}
              placeholder="Phone number for delivery updates"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                marginBottom: 10,
              }}
            />

            {buyer?.mobile && (savedInstructions[buyer.mobile]?.length ?? 0) > 0 && (
              <select
                onChange={(e) => setDeliveryComment(e.target.value)}
                style={{
                  display: "block",
                  padding: 12,
                  marginBottom: 12,
                  width: "100%",
                  borderRadius: 10,
                }}
              >
                <option value="">Use previous instructions</option>
                {savedInstructions[buyer.mobile].map((ins, i) => (
                  <option key={i} value={ins}>
                    {ins}
                  </option>
                ))}
              </select>
            )}

            <textarea
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="Delivery address"
              style={{
                width: "100%",
                minHeight: 100,
                padding: 10,
                borderRadius: 8,
                marginBottom: 10,
              }}
            />

            <textarea
              value={deliveryComment}
              onChange={(e) => setDeliveryComment(e.target.value)}
              placeholder="Additional delivery instructions / comments"
              style={{
                width: "100%",
                minHeight: 80,
                padding: 10,
                borderRadius: 8,
                marginBottom: 10,
              }}
            />

            <input
              value={checkoutEmail}
              onChange={(e) => setCheckoutEmail(e.target.value)}
              placeholder="Email for invoice / verification"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                marginBottom: 10,
              }}
            />

            <button
              onClick={() => {
                setEmailVerificationSent(true);
                setMessage("Mock email verification link sent");
              }}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                marginBottom: 10,
                background: "#475569",
                color: "white",
                border: 0,
              }}
            >
              Send Email Verification Link
            </button>

            <button
              onClick={() => {
                setPaymentOtpSent(true);
                setMessage("Mock Twilio OTP sent: 654321");
              }}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                marginBottom: 10,
                background: "#475569",
                color: "white",
                border: 0,
              }}
            >
              Send Phone OTP
            </button>

            {paymentOtpSent && (
              <input
                value={paymentOtp}
                onChange={(e) => setPaymentOtp(e.target.value)}
                placeholder="Enter payment OTP 654321"
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 8,
                  marginBottom: 10,
                }}
              />
            )}

            <input
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="Name on card"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                marginBottom: 10,
              }}
            />

            <input
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              placeholder="Card number"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                marginBottom: 10,
              }}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 120px",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <input
                value={cardExpiry}
                onChange={(e) => setCardExpiry(e.target.value)}
                placeholder="MM/YY"
                style={{ padding: 10, borderRadius: 8 }}
              />
              <input
                value={cardCvv}
                onChange={(e) => setCardCvv(e.target.value)}
                placeholder="CVV"
                style={{ padding: 10, borderRadius: 8 }}
              />
            </div>

            <button
              onClick={() => {
                if (!deliveryAddress.trim()) {
                  setMessage("Enter delivery address before payment");
                  return;
                }
                if (!checkoutPhone.trim()) {
                  setMessage("Enter phone number for delivery updates");
                  return;
                }
                if (!checkoutEmail.trim()) {
                  setMessage("Enter email for invoice");
                  return;
                }
                if (!emailVerificationSent) {
                  setMessage("Verify email first");
                  return;
                }
                if (!paymentOtpSent || paymentOtp !== "654321") {
                  setMessage("Phone OTP validation failed");
                  return;
                }
                if (
                  !cardName.trim() ||
                  !cardNumber.trim() ||
                  !cardExpiry.trim() ||
                  !cardCvv.trim()
                ) {
                  setMessage("Enter complete card details");
                  return;
                }
                if (cardNumber.replace(/ /g, "").length !== 16) {
                  setMessage("Mock Stripe auth failed: invalid card number");
                  return;
                }
                if (cart.length === 0) {
                  setMessage("Cart is empty");
                  return;
                }

                if (buyer?.mobile) {
                  setSavedInstructions((prev) => ({
                    ...prev,
                    [buyer.mobile]: Array.from(
                      new Set([...(prev[buyer.mobile] || []), deliveryComment])
                    ),
                  }));

                  setOrderHistory((prev) => ({
                    ...prev,
                    [buyer.mobile]: [
                      ...(prev[buyer.mobile] || []),
                      {
                        total: subtotal,
                        items: cart.map((c) => `${c.name} x${c.qty}`).join(", "),
                        address: deliveryAddress,
                      },
                    ],
                  }));

                  setSavedAddresses((prev) => ({
                    ...prev,
                    [buyer.mobile]: Array.from(
                      new Set([...(prev[buyer.mobile] || []), deliveryAddress])
                    ),
                  }));
                }

                setMessage(
                  `Payment successful • card charged £${subtotal.toFixed(2)} • order placed`
                );
                setRoute("store");
              }}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                background: "#16a34a",
                color: "white",
                border: 0,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Confirm Payment
            </button>
          </div>
        )}

        {route === "buyer" && (
          <div style={{ maxWidth: 520 }}>
            <h2>Buyer UAT Login</h2>
            <p style={{ color: "#94a3b8", marginBottom: 16 }}>
              First-time users register with OTP once. Future login requires only mobile.
            </p>

            {!otpSent ? (
              <>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Buyer name (first time only)"
                  style={{
                    display: "block",
                    padding: 12,
                    marginBottom: 12,
                    width: "100%",
                    borderRadius: 10,
                  }}
                />
                <input
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="Mobile number"
                  style={{
                    display: "block",
                    padding: 12,
                    marginBottom: 12,
                    width: "100%",
                    borderRadius: 10,
                  }}
                />
                <Btn
                  label={buyer ? "Login Buyer" : "Register / Send OTP"}
                  onClick={registerOrLoginBuyer}
                />
              </>
            ) : (
              <>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter OTP (123456)"
                  style={{
                    display: "block",
                    padding: 12,
                    marginBottom: 12,
                    width: "100%",
                    borderRadius: 10,
                  }}
                />
                <Btn label="Verify OTP" onClick={verifyOtp} />
              </>
            )}
          </div>
        )}
      </main>

      <aside style={{ padding: 20, borderLeft: "1px solid #334155" }}>
        <h3>Cart</h3>

        {cart.length === 0 ? (
          <div>Empty</div>
        ) : (
          <>
            {cart.map((x) => (
              <div key={x.id} style={{ marginBottom: 10 }}>
                <div>
                  {x.name} x{x.qty} — £{getLineTotal(x).toFixed(2)}
                </div>

                <div style={{ color: "#86efac", fontSize: 12 }}>
                  Saving: £{getLineSavings(x).toFixed(2)}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => decreaseQty(x.id)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: "#334155",
                      color: "white",
                      border: 0,
                      cursor: "pointer",
                    }}
                  >
                    −
                  </button>

                  <button
                    onClick={() => addToCart(x)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: "#2563eb",
                      color: "white",
                      border: 0,
                      cursor: "pointer",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}

            <hr style={{ margin: "16px 0" }} />
            <div style={{ color: "#86efac", marginBottom: 8 }}>
              Your savings: £{totalSavings.toFixed(2)}
            </div>
            <strong>Total: £{subtotal.toFixed(2)}</strong>

            <div style={{ marginTop: 16 }}>
              <button
                onClick={() => {
                  if (cart.length === 0) {
                    setMessage("Cart is empty");
                    return;
                  }
                  setRoute("checkout");
                }}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "#16a34a",
                  color: "white",
                  border: 0,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Proceed to Payment
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}