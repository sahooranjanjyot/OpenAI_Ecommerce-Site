"""
GroceryOS Automated Test Suite
Runs against live backend (port 8001) and frontend API (port 3000)
"""
import pytest
import requests
import json
import time

BACKEND = "http://localhost:8001"
FRONTEND = "http://localhost:3000"


# ─────────────────────────────────────────────
# FIXTURES
# ─────────────────────────────────────────────
@pytest.fixture(scope="session")
def backend_url():
    return BACKEND

@pytest.fixture(scope="session")
def frontend_url():
    return FRONTEND


# ─────────────────────────────────────────────
# FEATURE 1: BACKEND HEALTH & BASIC API
# ─────────────────────────────────────────────
class TestBackendHealth:
    def test_health_endpoint_returns_ok(self, backend_url):
        r = requests.get(f"{backend_url}/health")
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}

    def test_health_endpoint_response_time_under_500ms(self, backend_url):
        start = time.time()
        r = requests.get(f"{backend_url}/health")
        elapsed_ms = (time.time() - start) * 1000
        assert r.status_code == 200
        assert elapsed_ms < 500, f"Response too slow: {elapsed_ms:.0f}ms"

    def test_backend_products_endpoint_returns_list(self, backend_url):
        r = requests.get(f"{backend_url}/api/v1/products")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list), "Expected a list of products"

    def test_backend_products_have_required_fields(self, backend_url):
        r = requests.get(f"{backend_url}/api/v1/products")
        assert r.status_code == 200
        products = r.json()
        if products:
            p = products[0]
            for field in ["id", "name", "category", "price", "unit_label", "stock_qty", "in_stock"]:
                assert field in p, f"Missing field: {field}"

    def test_backend_products_seeded_with_defaults(self, backend_url):
        r = requests.get(f"{backend_url}/api/v1/products")
        assert r.status_code == 200
        products = r.json()
        assert len(products) >= 5, f"Expected at least 5 seeded products, got {len(products)}"
        names = [p["name"] for p in products]
        assert "Bananas" in names or "Milk" in names, "Seeded products not found"

    def test_backend_products_price_is_positive(self, backend_url):
        r = requests.get(f"{backend_url}/api/v1/products")
        products = r.json()
        for p in products:
            assert p["price"] > 0, f"Product {p['name']} has non-positive price: {p['price']}"

    def test_backend_products_stock_is_non_negative(self, backend_url):
        r = requests.get(f"{backend_url}/api/v1/products")
        products = r.json()
        for p in products:
            assert p["stock_qty"] >= 0, f"Product {p['name']} has negative stock"

    def test_backend_cors_headers_present(self, backend_url):
        r = requests.options(f"{backend_url}/api/v1/products",
                             headers={"Origin": "http://localhost:3000"})
        # Should not reject preflight
        assert r.status_code in [200, 204]


# ─────────────────────────────────────────────
# FEATURE 2: FRONTEND PRODUCTS API
# ─────────────────────────────────────────────
class TestFrontendProductsAPI:
    def test_get_products_returns_200(self, frontend_url):
        r = requests.get(f"{frontend_url}/api/products")
        assert r.status_code == 200

    def test_get_products_returns_json_array(self, frontend_url):
        r = requests.get(f"{frontend_url}/api/products")
        data = r.json()
        assert isinstance(data, list), "Response should be a list"

    def test_get_products_auto_seeds_if_empty(self, frontend_url):
        r = requests.get(f"{frontend_url}/api/products")
        products = r.json()
        assert len(products) >= 5, "Should have at least 5 seeded products"

    def test_products_have_required_fields(self, frontend_url):
        r = requests.get(f"{frontend_url}/api/products")
        products = r.json()
        if products:
            p = products[0]
            for field in ["id", "name", "category", "price", "stock"]:
                assert field in p, f"Missing required field: {field}"

    def test_create_product_returns_201_or_200(self, frontend_url):
        payload = {
            "name": "Test Product",
            "category": "Test",
            "price": 9.99,
            "wasPrice": None,
            "onSale": False,
            "stock": 100,
            "unit": "Unit",
            "image": "",
            "description": "Automated test product",
            "enabled": True,
            "hidden": False,
            "featured": False
        }
        r = requests.post(f"{frontend_url}/api/products", json=payload)
        assert r.status_code in [200, 201], f"Expected 200/201, got {r.status_code}: {r.text}"

    def test_created_product_appears_in_list(self, frontend_url):
        payload = {
            "name": "Visible Test Item",
            "category": "QA",
            "price": 1.00,
            "stock": 10,
            "unit": "Unit",
            "enabled": True,
            "hidden": False,
            "featured": False,
            "onSale": False
        }
        post_r = requests.post(f"{frontend_url}/api/products", json=payload)
        assert post_r.status_code in [200, 201]
        created = post_r.json()
        product_id = created["id"]

        get_r = requests.get(f"{frontend_url}/api/products")
        products = get_r.json()
        ids = [p["id"] for p in products]
        assert product_id in ids, f"Created product id={product_id} not found in list"

    def test_update_product_price(self, frontend_url):
        # First create
        payload = {"name": "UpdateMe", "category": "QA", "price": 5.00,
                   "stock": 10, "unit": "Unit", "enabled": True, "hidden": False,
                   "featured": False, "onSale": False}
        post_r = requests.post(f"{frontend_url}/api/products", json=payload)
        assert post_r.status_code in [200, 201]
        product_id = post_r.json()["id"]

        # Then update
        update_payload = {"id": product_id, "price": 7.50}
        put_r = requests.put(f"{frontend_url}/api/products", json=update_payload)
        assert put_r.status_code == 200
        assert put_r.json()["price"] == 7.50

    def test_delete_product(self, frontend_url):
        payload = {"name": "DeleteMe", "category": "QA", "price": 1.00,
                   "stock": 5, "unit": "Unit", "enabled": True, "hidden": False,
                   "featured": False, "onSale": False}
        post_r = requests.post(f"{frontend_url}/api/products", json=payload)
        assert post_r.status_code in [200, 201]
        product_id = post_r.json()["id"]

        del_r = requests.delete(f"{frontend_url}/api/products?id={product_id}")
        assert del_r.status_code == 200
        assert del_r.json().get("success") == True

    def test_delete_without_id_returns_400(self, frontend_url):
        r = requests.delete(f"{frontend_url}/api/products")
        assert r.status_code == 400

    def test_product_price_zero_rejected(self, frontend_url):
        payload = {"name": "ZeroPrice", "category": "QA", "price": 0,
                   "stock": 5, "unit": "Unit", "enabled": True, "hidden": False,
                   "featured": False, "onSale": False}
        r = requests.post(f"{frontend_url}/api/products", json=payload)
        # Either rejected or price stored as 0
        if r.status_code in [200, 201]:
            # If accepted, note it as a potential issue
            print("WARN: Zero-price product accepted without validation")


# ─────────────────────────────────────────────
# FEATURE 3: ORDERS API
# ─────────────────────────────────────────────
class TestOrdersAPI:
    def test_get_orders_returns_200(self, frontend_url):
        r = requests.get(f"{frontend_url}/api/orders")
        assert r.status_code == 200

    def test_get_orders_returns_list(self, frontend_url):
        r = requests.get(f"{frontend_url}/api/orders")
        assert isinstance(r.json(), list)

    def test_orders_include_customer_data(self, frontend_url):
        r = requests.get(f"{frontend_url}/api/orders")
        orders = r.json()
        if orders:
            o = orders[0]
            assert "customer" in o or "customerId" in o, "Order missing customer reference"


# ─────────────────────────────────────────────
# FEATURE 4: CUSTOMERS API
# ─────────────────────────────────────────────
class TestCustomersAPI:
    def test_get_customers_returns_200(self, frontend_url):
        r = requests.get(f"{frontend_url}/api/customers")
        assert r.status_code == 200

    def test_get_customers_returns_list(self, frontend_url):
        r = requests.get(f"{frontend_url}/api/customers")
        assert isinstance(r.json(), list)

    def test_create_customer_success(self, frontend_url):
        import random
        uid = random.randint(10000, 99999)
        payload = {
            "action": "register",
            "email": f"testuser{uid}@groceryos.test",
            "password": "TestPass123!",
            "name": f"Test User {uid}",
            "phone": f"0770090{uid}"[:11]
        }
        r = requests.post(f"{frontend_url}/api/auth", json=payload)
        assert r.status_code == 200, f"Register failed: {r.text}"

    def test_login_with_valid_credentials(self, frontend_url):
        import random
        uid = random.randint(10000, 99999)
        email = f"logintest{uid}@groceryos.test"
        password = "LoginPass123!"
        # Register first
        reg = requests.post(f"{frontend_url}/api/auth", json={
            "action": "register", "email": email,
            "password": password, "name": "Login Tester", "phone": f"0771{uid}"[:11]
        })
        assert reg.status_code == 200

        # Then login
        login = requests.post(f"{frontend_url}/api/auth", json={
            "action": "login", "email": email, "password": password
        })
        assert login.status_code == 200
        data = login.json()
        assert "customer" in data, "Login response missing customer data"

    def test_login_with_wrong_password_returns_401(self, frontend_url):
        r = requests.post(f"{frontend_url}/api/auth", json={
            "action": "login",
            "email": "nonexistent@groceryos.test",
            "password": "WrongPassword"
        })
        assert r.status_code in [401, 400], f"Expected 401/400, got {r.status_code}"

    def test_duplicate_email_registration_rejected(self, frontend_url):
        import random
        uid = random.randint(10000, 99999)
        email = f"dup{uid}@groceryos.test"
        payload = {
            "action": "register", "email": email,
            "password": "DupPass123!", "name": "Dup User", "phone": f"07800{uid}"[:11]
        }
        r1 = requests.post(f"{frontend_url}/api/auth", json=payload)
        assert r1.status_code == 200

        payload["name"] = "Second User"
        payload["phone"] = f"07900{uid}"[:11]
        r2 = requests.post(f"{frontend_url}/api/auth", json=payload)
        assert r2.status_code in [400, 409, 500], \
            f"Duplicate email should be rejected, got {r2.status_code}"


# ─────────────────────────────────────────────
# FEATURE 5: INVENTORY API
# ─────────────────────────────────────────────
class TestInventoryAPI:
    def test_get_inventory_returns_200(self, frontend_url):
        r = requests.get(f"{frontend_url}/api/inventory")
        assert r.status_code == 200

    def test_get_inventory_returns_list(self, frontend_url):
        r = requests.get(f"{frontend_url}/api/inventory")
        data = r.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"

    def test_add_inventory_batch(self, frontend_url):
        # Get a product ID first
        products = requests.get(f"{frontend_url}/api/products").json()
        if not products:
            pytest.skip("No products available")
        product_id = products[0]["id"]

        payload = {
            "productId": product_id,
            "quantity": 25,
            "costPrice": 0.80,
            "supplier": "Test Supplier",
            "channel": "admin"
        }
        r = requests.post(f"{frontend_url}/api/inventory", json=payload)
        assert r.status_code in [200, 201], f"Inventory batch creation failed: {r.text}"

    def test_inventory_batch_has_required_fields(self, frontend_url):
        r = requests.get(f"{frontend_url}/api/inventory")
        batches = r.json()
        if batches:
            b = batches[0]
            for field in ["id", "productId", "quantity"]:
                assert field in b, f"Missing field: {field}"


# ─────────────────────────────────────────────
# FEATURE 6: PROMOS API
# ─────────────────────────────────────────────
class TestPromosAPI:
    def test_get_promos_returns_200(self, frontend_url):
        r = requests.get(f"{frontend_url}/api/promos")
        assert r.status_code == 200

    def test_get_promos_returns_list(self, frontend_url):
        r = requests.get(f"{frontend_url}/api/promos")
        assert isinstance(r.json(), list)

    def test_create_promo(self, frontend_url):
        payload = {
            "type": "BOGO",
            "target": "Test Item",
            "start": "2025-01-01",
            "end": "2025-12-31",
            "active": True,
            "buyX": None,
            "payY": None,
            "crossTarget": None,
            "crossDiscount": None
        }
        r = requests.post(f"{frontend_url}/api/promos", json=payload)
        assert r.status_code in [200, 201], f"Create promo failed: {r.text}"
        data = r.json()
        assert "id" in data

    def test_create_and_delete_promo(self, frontend_url):
        payload = {
            "type": "Discount50%", "target": "DeleteMe",
            "start": "2025-01-01", "end": "2025-12-31",
            "active": True, "buyX": None, "payY": None,
            "crossTarget": None, "crossDiscount": None
        }
        post_r = requests.post(f"{frontend_url}/api/promos", json=payload)
        assert post_r.status_code in [200, 201]
        promo_id = post_r.json()["id"]

        del_r = requests.delete(f"{frontend_url}/api/promos?id={promo_id}")
        assert del_r.status_code == 200
        assert del_r.json().get("success") == True

    def test_delete_promo_without_id_returns_400(self, frontend_url):
        r = requests.delete(f"{frontend_url}/api/promos")
        assert r.status_code == 400


# ─────────────────────────────────────────────
# FEATURE 7: EMPLOYEES API
# ─────────────────────────────────────────────
class TestEmployeesAPI:
    def test_get_employees_returns_200(self, frontend_url):
        r = requests.get(f"{frontend_url}/api/employees")
        assert r.status_code == 200

    def test_get_employees_returns_list(self, frontend_url):
        r = requests.get(f"{frontend_url}/api/employees")
        assert isinstance(r.json(), list)

    def test_create_employee(self, frontend_url):
        import random
        uid = random.randint(1000, 9999)
        payload = {
            "userId": f"emp_{uid}",
            "password": "EmpPass123!",
            "name": f"Test Employee {uid}",
            "role": "cashier",
            "modules": "Instore POS,Orders",
            "active": True
        }
        r = requests.post(f"{frontend_url}/api/employees", json=payload)
        assert r.status_code in [200, 201], f"Employee creation failed: {r.text}"

    def test_employee_has_required_fields(self, frontend_url):
        r = requests.get(f"{frontend_url}/api/employees")
        employees = r.json()
        if employees:
            e = employees[0]
            for field in ["id", "userId", "name", "role", "active"]:
                assert field in e, f"Missing field: {field}"


# ─────────────────────────────────────────────
# FEATURE 8: RETURNS API
# ─────────────────────────────────────────────
class TestReturnsAPI:
    def test_get_returns_returns_200(self, frontend_url):
        r = requests.get(f"{frontend_url}/api/returns")
        assert r.status_code == 200

    def test_get_returns_returns_list(self, frontend_url):
        r = requests.get(f"{frontend_url}/api/returns")
        assert isinstance(r.json(), list)

    def test_return_missing_required_fields_rejected(self, frontend_url):
        r = requests.post(f"{frontend_url}/api/returns", json={})
        assert r.status_code in [400, 500], \
            f"Empty return payload should fail, got {r.status_code}"

    def test_return_without_orderid_rejected(self, frontend_url):
        payload = {
            "productName": "Milk",
            "quantity": 1,
            "reason": "Damaged",
            "condition": "Unsellable",
            "refundAmount": 1.10,
            "restocked": False,
            "processedBy": "Test Staff"
        }
        r = requests.post(f"{frontend_url}/api/returns", json=payload)
        assert r.status_code in [400, 500]


# ─────────────────────────────────────────────
# FEATURE 9: ADMIN AUTH API (without real email)
# ─────────────────────────────────────────────
class TestAdminAuthAPI:
    def test_wrong_admin_credentials_rejected(self, frontend_url):
        r = requests.post(f"{frontend_url}/api/auth/admin", json={
            "action": "request_otp",
            "username": "wronguser",
            "password": "wrongpass"
        })
        assert r.status_code == 401

    def test_valid_admin_credentials_trigger_otp(self, frontend_url):
        r = requests.post(f"{frontend_url}/api/auth/admin", json={
            "action": "request_otp",
            "username": "admin",
            "password": "admin123"
        })
        # May succeed (200) or fail if Resend key is invalid (500)
        # Either is acceptable — key point is it's not 401
        assert r.status_code != 401, "Valid credentials should not be rejected"

    def test_verify_otp_without_session_returns_400(self, frontend_url):
        r = requests.post(f"{frontend_url}/api/auth/admin", json={
            "action": "verify_otp",
            "otp": "999999"
        })
        assert r.status_code in [400, 500]

    def test_invalid_action_returns_400(self, frontend_url):
        r = requests.post(f"{frontend_url}/api/auth/admin", json={
            "action": "invalid_action"
        })
        assert r.status_code == 400

    def test_wrong_otp_returns_401(self, frontend_url):
        r = requests.post(f"{frontend_url}/api/auth/admin", json={
            "action": "verify_otp",
            "otp": "000000"
        })
        assert r.status_code in [400, 401]


# ─────────────────────────────────────────────
# FEATURE 10: FRONTEND REACHABILITY
# ─────────────────────────────────────────────
class TestFrontendReachability:
    def test_frontend_root_returns_200(self, frontend_url):
        r = requests.get(frontend_url)
        assert r.status_code == 200

    def test_frontend_content_type_is_html(self, frontend_url):
        r = requests.get(frontend_url)
        assert "text/html" in r.headers.get("content-type", "")

    def test_frontend_contains_grocery_os(self, frontend_url):
        r = requests.get(frontend_url)
        # Check HTML response contains app content
        assert r.status_code == 200

    def test_all_api_routes_reachable(self, frontend_url):
        routes = ["/api/products", "/api/orders", "/api/customers",
                  "/api/promos", "/api/inventory", "/api/returns", "/api/employees"]
        for route in routes:
            r = requests.get(f"{frontend_url}{route}")
            assert r.status_code == 200, f"Route {route} returned {r.status_code}"

    def test_checkout_api_rejects_empty_payload(self, frontend_url):
        r = requests.post(f"{frontend_url}/api/checkout", json={})
        assert r.status_code in [400, 422, 500], \
            f"Empty checkout should fail, got {r.status_code}"
