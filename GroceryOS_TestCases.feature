# Grocery OS - Comprehensive Test Scenarios (Gherkin)

```gherkin
# ============================================================================
# FEATURE 1: CUSTOMER AUTHENTICATION
# ============================================================================

Feature: Customer Authentication
  As a customer
  I want to securely register, login, and reset my password
  So that I can access my account and place orders

  Background:
    Given the application is running on "http://localhost:3000"
    And the database is in a clean state

  @smoke @ui @positive
  Scenario: Successful customer registration with valid details
    Given I am on the customer sign-in page
    When I click on "Register" tab
    And I enter "John Doe" in the name field
    And I enter "john.doe@example.com" in the email field
    And I enter "07712345678" in the phone field
    And I enter "Password123!" in the password field
    And I click the "Create Account" button
    Then I should see a success message "Account created successfully"
    And I should be redirected to the store page
    And I should see "John Doe" in the user profile section

  @regression @ui @positive
  Scenario: Successful customer login with existing credentials
    Given a customer exists with email "existing@example.com" and password "SecurePass123"
    And I am on the customer sign-in page
    When I enter "existing@example.com" in the email field
    And I enter "SecurePass123" in the password field
    And I click the "Sign In" button
    Then I should be redirected to the store page
    And I should see my name in the user profile section

  @regression @negative @ui
  Scenario: Registration fails with duplicate email
    Given a customer exists with email "duplicate@example.com"
    And I am on the customer sign-in page
    When I click on "Register" tab
    And I enter "Jane Smith" in the name field
    And I enter "duplicate@example.com" in the email field
    And I enter "07798765432" in the phone field
    And I enter "NewPass123!" in the password field
    And I click the "Create Account" button
    Then I should see an error message "Email already registered"
    And I should remain on the registration page

  @regression @negative @ui
  Scenario: Registration fails with duplicate phone number
    Given a customer exists with phone "07712345678"
    And I am on the customer sign-in page
    When I click on "Register" tab
    And I enter "Bob Johnson" in the name field
    And I enter "bob@example.com" in the email field
    And I enter "07712345678" in the phone field
    And I enter "BobPass123!" in the password field
    And I click the "Create Account" button
    Then I should see an error message "Phone number already registered"
    And I should remain on the registration page

  @regression @negative @ui
  Scenario: Login fails with incorrect password
    Given a customer exists with email "test@example.com" and password "CorrectPass123"
    And I am on the customer sign-in page
    When I enter "test@example.com" in the email field
    And I enter "WrongPassword" in the password field
    And I click the "Sign In" button
    Then I should see an error message "Invalid credentials"
    And I should remain on the sign-in page

  @regression @negative @ui
  Scenario: Login fails with non-existent email
    Given I am on the customer sign-in page
    When I enter "nonexistent@example.com" in the email field
    And I enter "SomePassword123" in the password field
    And I click the "Sign In" button
    Then I should see an error message "Account not found"
    And I should remain on the sign-in page

  @regression @positive @ui
  Scenario: Customer initiates password reset successfully
    Given a customer exists with email "reset@example.com"
    And I am on the customer sign-in page
    When I click on "Forgot Password?" link
    And I enter "reset@example.com" in the email field
    And I click the "Send Reset Link" button
    Then I should see a success message "Password reset link sent to your email"
    And an email should be sent to "reset@example.com" with subject "Password Reset"

  @regression @api @positive
  Scenario: Customer registration API creates account correctly
    When I send a POST request to "/api/auth" with body:
      """
      {
        "action": "register",
        "email": "api.user@example.com",
        "password": "ApiPass123!",
        "name": "API User",
        "phone": "07700900123"
      }
      """
    Then the response status code should be 200
    And the response should contain "success": true
    And a customer record should exist in database with email "api.user@example.com"

  @regression @api @negative
  Scenario: Customer login API rejects invalid credentials
    Given a customer exists with email "valid@example.com" and password "ValidPass123"
    When I send a POST request to "/api/auth" with body:
      """
      {
        "action": "login",
        "email": "valid@example.com",
        "password": "InvalidPassword"
      }
      """
    Then the response status code should be 401
    And the response should contain "error": "Invalid credentials"

  @smoke @negative @ui
  Scenario Outline: Registration validation rejects invalid inputs
    Given I am on the customer sign-in page
    When I click on "Register" tab
    And I enter "<name>" in the name field
    And I enter "<email>" in the email field
    And I enter "<phone>" in the phone field
    And I enter "<password>" in the password field
    And I click the "Create Account" button
    Then I should see validation error "<error_message>"

    Examples:
      | name      | email                | phone       | password    | error_message                  |
      |           | test@example.com     | 07712345678 | Pass123!    | Name is required               |
      | John Doe  | invalid-email        | 07712345678 | Pass123!    | Invalid email format           |
      | John Doe  | test@example.com     | 123         | Pass123!    | Invalid phone number           |
      | John Doe  | test@example.com     | 07712345678 | short       | Password must be at least 8 characters |
      | John Doe  | test@example.com     |             | Pass123!    | Phone is required              |

  @regression @ui @positive
  Scenario: Customer can logout successfully
    Given I am logged in as customer "logout@example.com"
    And I am on the store page
    When I click on the user profile dropdown
    And I click "Logout"
    Then I should be redirected to the sign-in page
    And I should not see my name in the navigation
    And my session should be cleared


# ============================================================================
# FEATURE 2: PRODUCT CATALOG BROWSING
# ============================================================================

Feature: Product Catalog Browsing
  As a customer
  I want to browse, search, filter and sort products
  So that I can find items I want to purchase

  Background:
    Given the application is running on "http://localhost:3000"
    And the following products exist in the database:
      | name          | category   | price | stock | enabled | hidden | featured |
      | Whole Milk    | Dairy      | 1.20  | 50    | true    | false  | true     |
      | Brown Bread   | Bakery     | 0.95  | 30    | true    | false  | false    |
      | Orange Juice  | Beverages  | 2.50  | 20    | true    | false  | true     |
      | Greek Yogurt  | Dairy      | 3.00  | 15    | true    | false  | false    |
      | Bananas       | Fruits     | 1.50  | 100   | true    | false  | true     |
      | Hidden Item   | Misc       | 5.00  | 10    | true    | true   | false    |
      | Disabled Item | Misc       | 5.00  | 10    | false   | false  | false    |

  @smoke @ui @positive
  Scenario: Customer views all available products on store page
    Given I am on the store page
    Then I should see 5 products displayed
    And I should see product "Whole Milk" with price "£1.20"
    And I should see product "Brown Bread" with price "£0.95"
    And I should see product "Orange Juice" with price "£2.50"
    And I should not see product "Hidden Item"
    And I should not see product "Disabled Item"

  @smoke @ui @positive
  Scenario: Customer sees featured products highlighted
    Given I am on the store page
    Then I should see "Featured Products" section
    And I should see 3 products in featured section
    And featured section should contain "Whole Milk"
    And featured section should contain "Orange Juice"
    And featured section should contain "Bananas"

  @regression @ui @positive
  Scenario: Customer searches for products by name
    Given I am on the store page
    When I enter "milk" in the search box
    Then I should see 1 product displayed
    And I should see product "Whole Milk"
    And I should not see product "Brown Bread"

  @regression @ui @positive
  Scenario: Customer searches with partial match
    Given I am on the store page
    When I enter "bre" in the search box
    Then I should see 1 product displayed
    And I should see product "Brown Bread"

  @regression @ui @positive
  Scenario: Customer filters products by category
    Given I am on the store page
    When I select "Dairy" from the category filter dropdown
    Then I should see 2 products displayed
    And I should see product "Whole Milk"
    And I should see product "Greek Yogurt"
    And I should not see product "Brown Bread"

  @regression @ui @positive
  Scenario: Customer filters products by multiple categories
    Given I am on the store page
    When I select "Dairy" from the category filter dropdown
    And I additionally select "Bakery" from the category filter
    Then I should see 3 products displayed
    And I should see products from "Dairy" and "Bakery" categories

  @regression @ui @positive
  Scenario: Customer sorts products by price ascending
    Given I am on the store page
    When I select "Price: Low to High" from the sort dropdown
    Then products should be displayed in order: "Brown Bread", "Whole Milk", "Bananas", "Orange Juice", "Greek Yogurt"

  @regression @ui @positive
  Scenario: Customer sorts products by price descending
    Given I am on the store page
    When I select "Price: High to Low" from the sort dropdown
    Then products should be displayed in order: "Greek Yogurt", "Orange Juice", "Bananas", "Whole Milk", "Brown Bread"

  @regression @ui @positive
  Scenario: Customer sorts products by name alphabetically
    Given I am on the store page
    When I select "Name: A-Z" from the sort dropdown
    Then products should be displayed in order: "Bananas", "Brown Bread", "Greek Yogurt", "Orange Juice", "Whole Milk"

  @regression @ui @positive
  Scenario: Customer combines search and filter
    Given I am on the store page
    When I enter "e" in the search box
    And I select "Dairy" from the category filter dropdown
    Then I should see 1 product displayed
    And I should see product "Greek Yogurt"

  @regression @ui @negative
  Scenario: Customer searches with no matching results
    Given I am on the store page
    When I enter "xyz-nonexistent-product" in the search box
    Then I should see a message "No products found"
    And I should see 0 products displayed

  @regression @api @positive
  Scenario: Products API returns only enabled and non-hidden products
    When I send a GET request to "/api/products"
    Then the response status code should be 200
    And the response should contain 5 products
    And the response should include product with name "Whole Milk"
    And the response should not include product with name "Hidden Item"
    And the response should not include product with name "Disabled Item"

  @regression @api @positive
  Scenario: Backend FastAPI products endpoint returns all products
    When I send a GET request to "http://localhost:8001/api/v1/products"
    Then the response status code should be 200
    And the response should be a valid JSON array
    And each product should have fields: "id", "name", "category", "price", "stock"

  @smoke @ui @positive
  Scenario: Product details display correctly on product card
    Given I am on the store page
    When I view the product card for "Orange Juice"
    Then I should see price "£2.50"
    And I should see stock status "20 in stock"
    And I should see product image
    And I should see "Add to Cart" button

  @regression @ui @positive
  Scenario: Out of stock products show appropriate status
    Given a product "Apple Juice" exists with stock 0
    And I am on the store page
    When I view the product card for "Apple Juice"
    Then I should see "Out of Stock" label
    And the "Add to Cart" button should be disabled


# ============================================================================
# FEATURE 3: SHOPPING CART MANAGEMENT
# ============================================================================

Feature: Shopping Cart Management
  As a customer
  I want to add, remove, and adjust quantities in my cart
  So that I can manage items before checkout

  Background:
    Given I am on the store page
    And the following products exist:
      | name         | price | stock |
      | Whole Milk   | 1.20  | 50    |
      | Brown Bread  | 0.95  | 30    |
      | Orange Juice | 2.50  | 5     |

  @smoke @ui @positive
  Scenario: Customer adds single product to cart
    When I click "Add to Cart" on product "Whole Milk"
    Then the cart icon should show badge "1"
    And I should see a success notification "Added to cart"
    When I click on the cart icon
    Then I should see "Whole Milk" in cart with quantity 1
    And cart total should be "£1.20"

  @smoke @ui @positive
  Scenario: Customer adds multiple different products to cart
    When I click "Add to Cart" on product "Whole Milk"
    And I click "Add to Cart" on product "Brown Bread"
    And I click "Add to Cart" on product "Orange Juice"
    Then the cart icon should show badge "3"
    When I click on the cart icon
    Then I should see "Whole Milk" in cart with quantity 1
    And I should see "Brown Bread" in cart with quantity 1
    And I should see "Orange Juice" in cart with quantity 1
    And cart total should be "£4.65"

  @regression @ui @positive
  Scenario: Customer increases product quantity in cart
    Given I have added "Whole Milk" to cart
    When I click on the cart icon
    And I click the "+" button for "Whole Milk"
    Then "Whole Milk" quantity should be 2
    And cart total should be "£2.40"
    And the cart icon should show badge "2"

  @regression @ui @positive
  Scenario: Customer decreases product quantity in cart
    Given I have added "Whole Milk" to cart with quantity 3
    When I click on the cart icon
    And I click the "-" button for "Whole Milk"
    Then "Whole Milk" quantity should be 2
    And cart total should be "£2.40"

  @regression @ui @positive
  Scenario: Customer removes product from cart by decreasing to zero
    Given I have added "Whole Milk" to cart with quantity 1
    When I click on the cart icon
    And I click the "-" button for "Whole Milk"
    Then "Whole Milk" should not be in the cart
    And cart total should be "£0.00"
    And the cart icon should show badge "0"

  @regression @ui @positive
  Scenario: Customer removes product using remove button
    Given I have added "Whole Milk" to cart
    And I have added "Brown Bread" to cart
    When I click on the cart icon
    And I click the "Remove" button for "Whole Milk"
    Then "Whole Milk" should not be in the cart
    And I should see "Brown Bread" in cart
    And cart total should be "£0.95"

  @regression @ui @positive
  Scenario: Customer clears entire cart
    Given I have added "Whole Milk" to cart
    And I have added "Brown Bread" to cart
    And I have added "Orange Juice" to cart
    When I click on the cart icon
    And I click "Clear Cart" button
    Then the cart should be empty
    And cart total should be "£0.00"
    And the cart icon should show badge "0"

  @regression @ui @negative
  Scenario: Customer cannot add product beyond available stock
    Given "Orange Juice" has stock of 5
    And I have added "Orange Juice" to cart with quantity 5
    When I click on the cart icon
    And I click the "+" button for "Orange Juice"
    Then I should see an error "Stock limit reached"
    And "Orange Juice" quantity should remain 5

  @regression @ui @positive
  Scenario: Cart persists during browsing session
    Given I have added "Whole Milk" to cart
    When I navigate to "Offers" page
    And I navigate back to "Store" page
    Then the cart icon should still show badge "1"
    When I click on the cart icon
    Then I should see "Whole Milk" in cart

  @regression @ui @positive
  Scenario: Empty cart shows appropriate message
    Given I have no items in cart
    When I click on the cart icon
    Then I should see message "Your cart is empty"
    And I should see "Continue Shopping" button

  @regression @ui @positive
  Scenario: Cart displays correct calculations for multiple items
    Given I have added "Whole Milk" to cart with quantity 3
    And I have added "Brown Bread" to cart with quantity 2
    When I click on the cart icon
    Then I should see subtotal for "Whole Milk" as "£3.60"
    And I should see subtotal for "Brown Bread" as "£1.90"
    And cart total should be "£5.50"

  @regression @ui @positive
  Scenario: Customer adds same product multiple times
    When I click "Add to Cart" on product "Whole Milk"
    And I click "Add to Cart" on product "Whole Milk"
    And I click "Add to Cart" on product "Whole Milk"
    Then the cart icon should show badge "3"
    When I click on the cart icon
    Then I should see "Whole Milk" in cart with quantity 3
    And cart total should be "£3.60"

  @regression @ui @edge
  Scenario: Cart handles product with decimal quantities correctly
    Given a product "Cheese" exists with price 4.99 and stock 10
    When I add "Cheese" to cart with quantity 1
    And I click on the cart icon
    And I increase "Cheese" quantity to 3
    Then cart total should be "£14.97"

  @regression @ui @positive
  Scenario: Cart shows updated stock availability warnings
    Given "Orange Juice" has stock of 3
    And I have added "Orange Juice" to cart with quantity 2
    When stock for "Orange Juice" is updated to 1
    And I click on the cart icon
    Then I should see a warning "Some items exceed available stock"
    And "Orange Juice" should show stock warning


# ============================================================================
# FEATURE 4: PROMOTIONS AND DISCOUNTS
# ============================================================================

Feature: Promotions and Discounts
  As a customer
  I want to benefit from various promotions
  So that I can save money on my purchases

  Background:
    Given the application is running
    And the following products exist:
      | id | name         | price | stock |
      | 1  | Whole Milk   | 1.20  | 50    |
      | 2  | Brown Bread  | 2.00  | 30    |
      | 3  | Orange Juice | 3.00  | 20    |
      | 4  | Greek Yogurt | 4.00  | 15    |
      | 5  | Bananas      | 1.50  | 100   |

  @smoke @ui @positive
  Scenario: BOGO promotion adds free item automatically
    Given a BOGO promotion exists for product "Whole Milk"
    And I am on the store page
    When I add "Whole Milk" to cart with quantity 1
    And I view my cart
    Then I should see "Whole Milk" with quantity 2
    And I should see promotion label "Buy 1 Get 1 Free"
    And cart total should be "£1.20"

  @regression @ui @positive
  Scenario: BOGO promotion applies to multiple sets
    Given a BOGO promotion exists for product "Whole Milk"
    When I add "Whole Milk" to cart with quantity 3
    And I view my cart
    Then I should see "Whole Milk" with quantity 4
    And cart total should be "£3.60"

  @smoke @ui @positive
  Scenario: 50% discount promotion reduces price correctly
    Given a "Discount 50%" promotion exists for product "Brown Bread"
    And I am on the store page
    When I view product "Brown Bread"
    Then I should see original price "£2.00" struck through
    And I should see sale price "£1.00"
    When I add "Brown Bread" to cart
    And I view my cart
    Then cart total should be "£1.00"

  @regression @ui @positive
  Scenario: Buy X Pay Y promotion applies correct discount
    Given a "Buy 3 Pay 2" promotion exists for product "Orange Juice"
    When I add "Orange Juice" to cart with quantity 3
    And I view my cart
    Then I should see promotion label "Buy 3 Pay 2"
    And cart total should be "£6.00"
    And I should see savings of "£3.00"

  @regression @ui @positive
  Scenario: Buy X Pay Y promotion does not apply to insufficient quantity
    Given a "Buy 3 Pay 2" promotion exists for product "Orange Juice"
    When I add "Orange Juice" to cart with quantity 2
    And I view my cart
    Then I should not see promotion label
    And cart total should be "£6.00"

  @regression @ui @positive
  Scenario: Buy X Pay Y promotion applies to multiple sets
    Given a "Buy 3 Pay 2" promotion exists for product "Orange Juice"
    When I add "Orange Juice" to cart with quantity 6
    And I view my cart
    Then cart total should be "£12.00"
    And I should see savings of "£6.00"

  @regression @ui @positive
  Scenario: N for £X bundle pricing applies correctly
    Given a "3 for £5" promotion exists for product "Bananas"
    When I add "Bananas" to cart with quantity 3
    And I view my cart
    Then cart total should be "£5.00"
    And I should see promotion label "3 for £5.00"
    And I should see savings of "£-0.50"

  @regression @ui @positive
  Scenario: Cross-sell bundle discount applies when both products added
    Given a cross-sell promotion exists: "Buy Whole Milk, get 20% off Greek Yogurt"
    When I add "Whole Milk" to cart
    And I add "Greek Yogurt" to cart
    And I view my cart
    Then "Greek Yogurt" should show discounted price "£3.20"
    And I should see promotion label "Bundle Discount"
    And cart total should be "£4.40"

  @regression @ui @negative
  Scenario: Cross-sell discount does not apply without primary product
    Given a cross-sell promotion exists: "Buy Whole Milk, get 20% off Greek Yogurt"
    When I add "Greek Yogurt" to cart
    And I view my cart
    Then "Greek Yogurt" should show regular price "£4.00"
    And I should not see promotion label
    And cart total should be "£4.00"

  @regression @ui @positive
  Scenario: Global promotion applies percentage discount on total
    Given a global promotion exists: "10% off orders over £20"
    When I add "Orange Juice" to cart with quantity 5
    And I add "Brown Bread" to cart with quantity 3
    And I view my cart
    Then cart subtotal should be "£21.00"
    And I should see promotion discount "£2.10"
    And cart total should be "£18.90"

  @regression @ui @negative
  Scenario: Global promotion does not apply below threshold
    Given a global promotion exists: "10% off orders over £20"
    When I add "Whole Milk" to cart with quantity 5
    And I view my cart
    Then cart subtotal should be "£6.00"
    And I should not see promotion discount
    And cart total should be "£6.00"

  @regression @ui @positive
  Scenario: Global promotion applies fixed discount on total
    Given a global promotion exists: "£5 off orders over £30"
    When I add "Greek Yogurt" to cart with quantity 8
    And I view my cart
    Then cart subtotal should be "£32.00"
    And I should see promotion discount "£5.00"
    And cart total should be "£27.00"

  @regression @ui @positive
  Scenario: Multiple promotions stack correctly
    Given a "Discount 50%" promotion exists for product "Brown Bread"
    And a global promotion exists: "10% off orders over £20"
    When I add "Brown Bread" to cart with quantity 10
    And I add "Whole Milk" to cart with quantity 10
    And I view my cart
    Then "Brown Bread" subtotal should be "£10.00"
    And cart subtotal should be "£22.00"
    And I should see global discount "£2.20"
    And cart total should be "£19.80"

  @regression @ui @positive
  Scenario: Expired promotion does not apply
    Given a "Discount 50%" promotion exists for product "Bananas"
    And the promotion end date is "2024-01-01"
    And today's date is "2024-06-01"
    When I add "Bananas" to cart
    And I view my cart
    Then I should not see promotion label
    And cart total should be "£1.50"

  @regression @ui @positive
  Scenario: Inactive promotion does not apply
    Given a "Discount 50%" promotion exists for product "Bananas"
    And the promotion is marked as inactive
    When I add "Bananas" to cart
    And I view my cart
    Then I should not see promotion label
    And cart total should be "£1.50"

  @regression @api @positive
  Scenario: Promotions API returns all active promotions
    Given the following promotions exist:
      | type        | target      | active | start      | end        |
      | BOGO        | Whole Milk  | true   | 2024-01-01 | 2024-12-31 |
      | Discount50% | Brown Bread | true   | 2024-01-01 | 2024-12-31 |
      | BuyXPayY    | Bananas     | false  | 2024-01-01 | 2024-12-31 |
    When I send a GET request to "/api/promos"
    Then the response status code should be 200
    And the response should contain 2 active promotions
    And the response should not include inactive promotions

  @regression @ui @positive
  Scenario: Offers page shows only products with active promotions
    Given a "Discount 50%" promotion exists for product "Brown Bread"
    And a BOGO promotion exists for product "Whole Milk"
    When I navigate to the "Offers" page
    Then I should see 2 products displayed
    And I should see product "Brown Bread" with sale badge
    And I should see product "Whole Milk" with "BOGO" badge


# ============================================================================
# FEATURE 5: LOYALTY PROGRAM AND VOLUME DISCOUNTS
# ============================================================================

Feature: Loyalty Program and Volume Discounts
  As a returning customer
  I want to receive loyalty discounts and volume-based savings
  So that I am rewarded for my continued business

  Background:
    Given the application is running
    And the loyalty discount is configured as 15%
    And the following products exist:
      | name         | price | stock |
      | Whole Milk   | 2.00  | 50    |
      | Brown Bread  | 3.00  | 30    |
      | Orange Juice | 5.00  | 20    |

  @smoke @ui @positive
  Scenario: Loyalty customer receives configured discount on order
    Given I am logged in as customer "loyal@example.com"
    And my account has "LOYALTY" tag enabled
    When I add "Whole Milk" to cart with quantity 5
    And I proceed to checkout
    Then I should see subtotal "£10.00"
    And I should see loyalty discount "£1.50" (15%)
    And order total should be "£8.50"

  @regression @ui @positive
  Scenario: Non-loyalty customer does not receive loyalty discount
    Given I am logged in as customer "regular@example.com"
    And my account does not have "LOYALTY" tag
    When I add "Whole Milk" to cart with quantity 5
    And I proceed to checkout
    Then I should see subtotal "£10.00"
    And I should not see loyalty discount
    And order total should be "£10.00"

  @regression @ui @positive
  Scenario: Customer receives automatic 10% discount on orders over £60
    Given I am logged in as customer "regular@example.com"
    When I add "Orange Juice" to cart with quantity 15
    And I proceed to checkout
    Then I should see subtotal "£75.00"
    And I should see volume discount "£7.50" with label "Over £60 Discount"
    And order total should be "£67.50"

  @regression @ui @negative
  Scenario: Orders under £60 do not receive volume discount
    Given I am logged in as customer "regular@example.com"
    When I add "Orange Juice" to cart with quantity 10
    And I proceed to checkout
    Then I should see subtotal "£50.00"
    And I should not see volume discount
    And order total should be "£50.00"

  @regression @ui @positive
  Scenario: Loyalty and volume discounts stack correctly
    Given I am logged in as customer "loyal@example.com"
    And my account has "LOYALTY" tag enabled
    And the loyalty discount is configured as 15%
    When I add "Orange Juice" to cart with quantity 15
    And I proceed to checkout
    Then I should see subtotal "£75.00"
    And I should see loyalty discount "£11.25" (15%)
    And I should see volume discount "£6.38" (10% of £63.75)
    And order total should be "£57.37"

  @regression @ui @positive
  Scenario: Admin can toggle loyalty status for customer
    Given I am logged in as admin
    And a customer "newloyal@example.com" exists without loyalty status
    When I navigate to "Customers" page in admin dashboard
    And I search for customer "newloyal@example.com"
    And I click "Toggle Loyalty" button
    Then customer "newloyal@example.com" should have "LOYALTY" tag
    And I should see success message "Loyalty status updated"

  @regression @api @positive
  Scenario: Update customer API can enable loyalty tag
    Given a customer with id 5 exists without loyalty status
    When I send a PUT request to "/api/customers" with body:
      """
      {
        "id": 5,
        "loyalty": true
      }
      """
    Then the response status code should be 200
    And customer with id 5 should have loyalty flag set to true in database

  @regression @ui @positive
  Scenario: Loyalty discount displays on cart preview
    Given I am logged in as customer "loyal@example.com"
    And my account has "LOYALTY" tag enabled
    When I add "Whole Milk" to cart with quantity 5
    And I click on cart icon
    Then I should see estimated total with loyalty discount applied
    And I should see badge "Loyalty Member - 15% off"

  @regression @ui @edge
  Scenario: Volume discount calculates correctly

Feature: Checkout and Order Placement
  As a customer
  I want to complete my purchase with different payment methods
  So that I can receive my groceries

  @smoke @e2e @ui
  Scenario: Successful checkout with Cash on Delivery
    Given I am logged in as customer "alice@example.com" with password "Pass123!"
    And my cart contains:
      | product_name | quantity | unit_price |
      | Basmati Rice | 2        | 12.99      |
      | Olive Oil    | 1        | 8.50       |
    When I navigate to "/checkout"
    And I select payment method "Cash on Delivery"
    And I enter delivery address:
      | field        | value                |
      | street       | 123 Main Street      |
      | city         | Manchester           |
      | postcode     | M1 1AA               |
      | phone        | 07700900123          |
    And I click "Place Order"
    Then I should see order confirmation page
    And order total should be "34.48"
    And payment method should be "COD"
    And delivery address should contain "M1 1AA"

  @smoke @e2e @ui
  Scenario: Successful checkout with Stripe card payment
    Given I am logged in as customer "bob@example.com" with password "Pass123!"
    And my cart contains:
      | product_name    | quantity | unit_price |
      | Organic Apples  | 3        | 4.25       |
      | Greek Yogurt    | 2        | 3.99       |
    When I navigate to "/checkout"
    And I select payment method "Card Payment"
    And I enter delivery address:
      | field        | value                |
      | street       | 45 High Street       |
      | city         | London               |
      | postcode     | SW1A 1AA             |
      | phone        | 07700900456          |
    And I enter Stripe test card details:
      | card_number         | expiry | cvc | postcode |
      | 4242424242424242    | 12/25  | 123 | SW1A 1AA |
    And I click "Pay Now"
    Then I should see order confirmation page
    And order status should be "Paid"
    And I should receive order confirmation email

  @regression @ui
  Scenario: Postcode lookup auto-fills address
    Given I am logged in as customer "charlie@example.com" with password "Pass123!"
    And I have items in my cart
    When I navigate to "/checkout"
    And I enter postcode "EC1A 1BB" in address lookup
    And I click "Find Address"
    Then I should see dropdown with addresses:
      | address                              |
      | 1 London Street, London, EC1A 1BB    |
      | 2 London Street, London, EC1A 1BB    |
    When I select "1 London Street, London, EC1A 1BB"
    Then field "street" should contain "1 London Street"
    And field "city" should contain "London"
    And field "postcode" should contain "EC1A 1BB"

  @negative @ui
  Scenario: Checkout fails with invalid postcode
    Given I am logged in as customer "dave@example.com" with password "Pass123!"
    And I have items in my cart
    When I navigate to "/checkout"
    And I enter delivery address:
      | field        | value                |
      | street       | 78 Park Lane         |
      | city         | Birmingham           |
      | postcode     | INVALID              |
      | phone        | 07700900789          |
    And I select payment method "Cash on Delivery"
    And I click "Place Order"
    Then I should see error "Invalid UK postcode format"
    And order should not be created

  @negative @ui
  Scenario: Checkout fails with declined card
    Given I am logged in as customer "eve@example.com" with password "Pass123!"
    And my cart contains:
      | product_name | quantity | unit_price |
      | Honey        | 1        | 6.99       |
    When I navigate to "/checkout"
    And I select payment method "Card Payment"
    And I enter valid delivery address with postcode "W1A 0AX"
    And I enter Stripe test card details:
      | card_number         | expiry | cvc | postcode |
      | 4000000000000002    | 12/25  | 123 | W1A 0AX  |
    And I click "Pay Now"
    Then I should see error "Your card was declined"
    And order should not be created
    And cart should remain unchanged

  @regression @ui
  Scenario: Checkout applies promo code and calculates correct total
    Given I am logged in as customer "frank@example.com" with password "Pass123!"
    And my cart contains:
      | product_name | quantity | unit_price |
      | Coffee Beans | 4        | 9.99       |
    And active promo "SAVE10" gives "10%" discount on orders above "30.00"
    When I navigate to "/checkout"
    And I enter promo code "SAVE10"
    And I click "Apply"
    Then I should see discount of "3.996"
    And order total should be "35.96"
    When I enter valid delivery address with postcode "N1 9AG"
    And I select payment method "Cash on Delivery"
    And I click "Place Order"
    Then order should be created with discount "3.996"

  @e2e @ui
  Scenario: Guest checkout requires account creation
    Given I am not logged in
    And I have items in cart as guest
    When I navigate to "/checkout"
    Then I should be redirected to "/auth/login"
    And I should see message "Please log in to continue checkout"

Feature: Admin Authentication
  As an admin
  I want to securely log in with OTP 2FA
  So that only authorized users can access admin panel

  @smoke @e2e @ui
  Scenario: Successful admin login with OTP verification
    Given I am on "/admin/login"
    When I enter username "admin"
    And I enter password "admin123"
    And I click "Send OTP"
    Then I should see message "OTP sent to your email"
    And OTP email should be sent via Resend API
    When I retrieve the 6-digit OTP from email
    And I enter the OTP "123456"
    And I click "Verify OTP"
    Then I should be redirected to "/admin/dashboard"
    And session cookie "admin_session" should be set
    And I should see "Welcome, Admin"

  @smoke @api
  Scenario: Admin OTP request via API
    Given I send POST to "/api/auth/admin" with body:
      """
      {
        "action": "request_otp",
        "username": "admin",
        "password": "admin123"
      }
      """
    Then response status should be 200
    And response should contain:
      """
      {
        "success": true,
        "message": "OTP sent to admin email"
      }
      """
    And OTP should be stored in database with expiry 5 minutes from now

  @regression @api
  Scenario: Admin OTP verification via API
    Given admin OTP "987654" was generated 2 minutes ago for username "admin"
    When I send POST to "/api/auth/admin" with body:
      """
      {
        "action": "verify_otp",
        "username": "admin",
        "otp": "987654"
      }
      """
    Then response status should be 200
    And response should contain "token"
    And response body "success" should be true

  @negative @ui
  Scenario: Admin login fails with incorrect password
    Given I am on "/admin/login"
    When I enter username "admin"
    And I enter password "wrongpassword"
    And I click "Send OTP"
    Then I should see error "Invalid credentials"
    And no OTP email should be sent
    And I should remain on "/admin/login"

  @negative @ui
  Scenario: OTP verification fails with expired OTP
    Given I am on "/admin/login"
    And I have requested OTP with username "admin" and password "admin123"
    And OTP "555666" was generated 6 minutes ago
    When I enter the OTP "555666"
    And I click "Verify OTP"
    Then I should see error "OTP has expired. Please request a new one."
    And I should not be logged in

  @negative @ui
  Scenario: OTP verification fails with incorrect OTP
    Given I am on "/admin/login"
    And I have requested OTP with username "admin" and password "admin123"
    And valid OTP is "112233"
    When I enter the OTP "999999"
    And I click "Verify OTP"
    Then I should see error "Invalid OTP"
    And I should not be logged in
    And I should have 2 remaining attempts

  @regression @ui
  Scenario: Admin forgot password flow
    Given I am on "/admin/login"
    When I click "Forgot Password"
    Then I should be redirected to "/admin/forgot-password"
    When I enter email "admin@groceryos.com"
    And I click "Send Reset Link"
    Then I should see message "Password reset link sent to your email"
    And reset token should be generated and emailed

  @e2e @ui
  Scenario: Admin session expires after 2 hours of inactivity
    Given I am logged in as admin
    And my last activity was 121 minutes ago
    When I navigate to "/admin/products"
    Then I should be redirected to "/admin/login"
    And I should see message "Session expired. Please log in again."

Feature: Product Management CRUD
  As an admin
  I want to manage products in the catalog
  So that customers see accurate product information

  @smoke @e2e @ui
  Scenario: Admin creates new product successfully
    Given I am logged in as admin
    And I am on "/admin/products"
    When I click "Add New Product"
    And I fill in product form:
      | field         | value                      |
      | name          | Organic Bananas            |
      | description   | Fresh organic bananas      |
      | price         | 3.49                       |
      | stock         | 150                        |
      | category      | Fruits                     |
      | barcode       | 5012345678900              |
      | supplier      | Fresh Farms Ltd            |
    And I set flag "enabled" to true
    And I set flag "featured" to false
    And I upload image "banana.jpg"
    And I click "Save Product"
    Then I should see success message "Product created successfully"
    And product "Organic Bananas" should exist in database
    And I should see "Organic Bananas" in product list

  @smoke @api
  Scenario: Create product via API
    Given I am authenticated as admin with valid token
    When I send POST to "/api/products" with body:
      """
      {
        "name": "Whole Milk",
        "description": "Fresh whole milk 2L",
        "price": 2.89,
        "stock": 200,
        "category": "Dairy",
        "barcode": "5012345678901",
        "enabled": true,
        "featured": false,
        "hidden": false
      }
      """
    Then response status should be 201
    And response should contain "id"
    And product "Whole Milk" should exist in database with stock 200

  @regression @e2e @ui
  Scenario: Admin edits existing product
    Given I am logged in as admin
    And product exists:
      | name         | price | stock | enabled |
      | Cheddar Cheese | 4.99  | 50    | true    |
    And I am on "/admin/products"
    When I click "Edit" on product "Cheddar Cheese"
    And I update field "price" to "5.49"
    And I update field "stock" to "75"
    And I set flag "featured" to true
    And I click "Update Product"
    Then I should see success message "Product updated successfully"
    And product "Cheddar Cheese" should have price "5.49"
    And product "Cheddar Cheese" should have stock 75
    And product "Cheddar Cheese" should have featured flag true

  @regression @ui
  Scenario: Admin hides product from customer view
    Given I am logged in as admin
    And product exists:
      | name            | enabled | hidden |
      | Discontinued Item | true    | false  |
    And I am on "/admin/products"
    When I click "Edit" on product "Discontinued Item"
    And I set flag "hidden" to true
    And I click "Update Product"
    Then product "Discontinued Item" should have hidden flag true
    And customers should not see "Discontinued Item" in catalog

  @smoke @ui
  Scenario: Admin deletes product
    Given I am logged in as admin
    And product exists:
      | name         | price | stock |
      | Test Product | 9.99  | 10    |
    And I am on "/admin/products"
    When I click "Delete" on product "Test Product"
    Then I should see confirmation dialog "Are you sure you want to delete this product?"
    When I click "Confirm Delete"
    Then I should see success message "Product deleted successfully"
    And product "Test Product" should not exist in database

  @negative @api
  Scenario: Cannot create product with duplicate barcode
    Given product exists with barcode "5012345678902"
    And I am authenticated as admin
    When I send POST to "/api/products" with body:
      """
      {
        "name": "Another Product",
        "price": 1.99,
        "stock": 10,
        "barcode": "5012345678902",
        "enabled": true
      }
      """
    Then response status should be 409
    And response should contain error "Product with this barcode already exists"

  @negative @ui
  Scenario: Cannot save product with negative price
    Given I am logged in as admin
    And I am on "/admin/products/new"
    When I fill in product form:
      | field | value           |
      | name  | Invalid Product |
      | price | -5.00           |
      | stock | 10              |
    And I click "Save Product"
    Then I should see error "Price must be greater than 0"
    And product should not be saved

  @regression @ui
  Scenario: Admin filters products by enabled/hidden/featured flags
    Given I am logged in as admin
    And products exist:
      | name      | enabled | hidden | featured |
      | Product A | true    | false  | true     |
      | Product B | false   | false  | false    |
      | Product C | true    | true   | false    |
    And I am on "/admin/products"
    When I select filter "Featured Only"
    Then I should see only "Product A" in list
    When I select filter "Hidden Only"
    Then I should see only "Product C" in list
    When I select filter "Disabled Only"
    Then I should see only "Product B" in list

Feature: Inventory Management
  As an admin
  I want to manage inventory batches and view stock ledger
  So that I can track stock movements accurately

  @smoke @e2e @ui
  Scenario: Admin adds new inventory batch
    Given I am logged in as admin
    And product "Tomato Sauce" exists with current stock 20
    And I am on "/admin/inventory"
    When I click "Add Batch"
    And I select product "Tomato Sauce"
    And I enter batch details:
      | field           | value      |
      | quantity        | 100        |
      | cost_price      | 1.50       |
      | batch_number    | BATCH-2024-001 |
      | expiry_date     | 2024-12-31 |
      | supplier        | FoodCo Ltd |
    And I click "Save Batch"
    Then I should see success message "Inventory batch added successfully"
    And product "Tomato Sauce" should have stock 120
    And inventory ledger should show entry:
      | product       | type    | quantity | batch_number   |
      | Tomato Sauce  | IN      | 100      | BATCH-2024-001 |

  @smoke @api
  Scenario: Add inventory batch via API
    Given I am authenticated as admin
    And product with id "12" has stock 50
    When I send POST to "/api/inventory" with body:
      """
      {
        "product_id": 12,
        "quantity": 200,
        "cost_price": 2.25,
        "batch_number": "BATCH-2024-002",
        "expiry_date": "2025-01-15",
        "supplier": "Fresh Supplies"
      }
      """
    Then response status should be 201
    And product with id "12" should have stock 250
    And response should contain "batch_id"

  @regression @ui
  Scenario: Admin views inventory ledger with filters
    Given I am logged in as admin
    And inventory transactions exist:
      | product      | type | quantity | date       | user  |
      | Bread        | IN   | 50       | 2024-01-10 | admin |
      | Bread        | OUT  | 10       | 2024-01-11 | admin |
      | Milk         | IN   | 100      | 2024-01-12 | admin |
      | Bread        | OUT  | 5        | 2024-01-13 | admin |
    And I am on "/admin/inventory/ledger"
    When I filter by product "Bread"
    Then I should see 3 transactions
    When I filter by type "IN"
    Then I should see 1 transaction
    When I filter by date range "2024-01-11" to "2024-01-13"
    Then I should see 3 transactions

  @regression @e2e @ui
  Scenario: Admin voids inventory transaction
    Given I am logged in as admin
    And inventory transaction exists:
      | id  | product | type | quantity | batch_number   |
      | 101 | Pasta   | IN   | 75       | BATCH-2024-003 |
    And product "Pasta" has current stock 75
    And I am on "/admin/inventory/ledger"
    When I click "Void" on transaction "101"
    And I enter void reason "Entered wrong quantity"
    And I click "Confirm Void"
    Then transaction "101" should be marked as voided
    And product "Pasta" should have stock 0
    And ledger should show void entry with reason "Entered wrong quantity"

  @regression @ui
  Scenario: Admin syncs stock from external system
    Given I am logged in as admin
    And products exist with stock:
      | product | current_stock |
      | Rice    | 100           |
      | Beans   | 50            |
    And I am on "/admin/inventory/sync"
    When I upload CSV file "stock_sync.csv" with content:
      """
      product,stock
      Rice,120
      Beans,75
      """
    And I click "Sync Stock"
    Then I should see sync summary:
      | product | old_stock | new_stock | change |
      | Rice    | 100       | 120       | +20    |
      | Beans   | 50        | 75        | +25    |
    When I click "Confirm Sync"
    Then product "Rice" should have stock 120
    And product "Beans" should have stock 75
    And ledger should show sync entries for both products

  @negative @api
  Scenario: Cannot add batch with negative quantity
    Given I am authenticated as admin
    When I send POST to "/api/inventory" with body:
      """
      {
        "product_id": 5,
        "quantity": -10,
        "cost_price": 1.00,
        "batch_number": "INVALID"
      }
      """
    Then response status should be 400
    And response should contain error "Quantity must be positive"

  @negative @ui
  Scenario: Cannot void already voided transaction
    Given I am logged in as admin
    And voided inventory transaction exists:
      | id  | product | voided |
      | 202 | Sugar   | true   |
    And I am on "/admin/inventory/ledger"
    Then "Void" button should be disabled for transaction "202"

  @regression @ui
  Scenario: Inventory ledger shows running balance
    Given I am logged in as admin
    And inventory transactions exist for "Flour":
      | type | quantity | date       |
      | IN   | 100      | 2024-01-01 |
      | OUT  | 25       | 2024-01-02 |
      | IN   | 50       | 2024-01-03 |
      | OUT  | 10       | 2024-01-04 |
    And I am on "/admin/inventory/ledger"
    When I filter by product "Flour"
    Then ledger should show running balance:
      | date       | type | quantity | balance |
      | 2024-01-01 | IN   | 100      | 100     |
      | 2024-01-02 | OUT  | 25       | 75      |
      | 2024-01-03 | IN   | 50       | 125     |
      | 2024-01-04 | OUT  | 10       | 115     |

Feature: Order Management
  As an admin
  I want to view and manage customer orders
  So that I can track fulfillment and revenue

  @smoke @e2e @ui
  Scenario: Admin views all orders
    Given I am logged in as admin
    And orders exist:
      | order_id | customer          | total  | status    | date       |
      | ORD-001  | alice@example.com | 45.99  | Paid      | 2024-01-15 |
      | ORD-002  | bob@example.com   | 32.50  | Pending   | 2024-01-16 |
      | ORD-003  | charlie@example.com | 78.20 | Delivered | 2024-01-17 |
    And I am on "/admin/orders"
    Then I should see 3 orders
    And orders should be sorted by date descending

  @smoke @api
  Scenario: Fetch orders via API
    Given I am authenticated as admin
    And 5 orders exist in database
    When I send GET to "/api/orders"
    Then response status should be 200
    And response should contain array with 5 orders
    And each order should have fields "id,customer,total,status,date"

  @regression @ui
  Scenario: Admin filters orders by date range
    Given I am logged in as admin
    And orders exist:
      | order_id | date       | total |
      | ORD-101  | 2024-01-10 | 25.00 |
      | ORD-102  | 2024-01-15 | 30.00 |
      | ORD-103  | 2024-01-20 | 40.00 |
      | ORD-104  | 2024-01-25 | 35.00 |
    And I am on "/admin/orders"
    When I set date filter "from" to "2024-01-15"
    And I set date filter "to" to "2024-01-20"
    And I click "Apply Filter"
    Then I should see 2 orders
    And I should see orders "ORD-102,ORD-103"

  @regression @ui
  Scenario: Admin filters orders by status
    Given I am logged in as admin
    And orders exist with status:
      | order_id | status    |
      | ORD-201  | Paid      |
      | ORD-202  | Pending   |
      | ORD-203  | Delivered |
      | ORD-204  | Paid      |
      | ORD-205  | Cancelled |
    And I am on "/admin/orders"
    When I select status filter "Paid"
    Then I should see 2 orders
    And I should see orders "ORD-201,ORD-204"

  @smoke @ui
  Scenario: Admin views order details
    Given I am logged in as admin
    And order exists:
      | order_id | customer        | total | status | payment_method |
      | ORD-301  | dave@example.com | 89.50 | Paid   | Card           |
    And order "ORD-301" contains items:
      | product     | quantity | price |
      | Orange Juice | 3       | 4.50  |
      | Cereal      | 2        | 6.99  |
    And I am on "/admin/orders"
    When I click "View Details" on order "ORD-301"
    Then I should see order details page
    And I should see customer "dave@example.com"
    And I should see 2 line items
    And I should see total "89.50"
    And I should see payment method "Card"

  @regression @ui
  Scenario: Admin searches orders by customer email
    Given I am logged in as admin
    And orders exist:
      | order_id | customer         | total |
      | ORD-401  | john@example.com | 25.00 |
      | ORD-402  | jane@example.com | 30.00 |
      | ORD-403  | john@example.com | 40.00 |
    And I am on "/admin/orders"
    When I enter "john@example.com" in search field
    And I click "Search"
    Then I should see 2 orders
    And I should see orders "ORD-401,ORD-403"

  @regression @ui
  Scenario: Admin exports orders to CSV
    Given I am logged in as admin
    And 10 orders exist in database
    And I am on "/admin/orders"
    When I click "Export to CSV"
    Then CSV file "orders_export.csv" should be downloaded
    And CSV should contain 11 rows including header
    And CSV columns should be "OrderID,Customer,Date,Total,Status,PaymentMethod"

  @e2e @ui
  Scenario: Admin updates order status
    Given I am logged in as admin
    And order exists:
      | order_id | status  |
      | ORD-501  | Pending |
    And I am on "/admin/orders/ORD-501"
    When I select status "Processing"
    And I click "Update Status"
    Then I should see success message "Order status updated"
    And order "ORD-501" should have status "Processing"
    And customer should receive status update email

Feature: Customer CRM
  As an admin
  I want to manage customer accounts
  So that I can provide better service and handle issues

  @smoke @e2e @ui
  Scenario: Admin views all customers
    Given I am logged in as admin
    And customers exist:
      | email               | name          | loyalty_points | status  |
      | alice@example.com   | Alice Smith   | 150            | Active  |
      | bob@example.com     | Bob Jones     | 80             | Active  |
      | charlie@example.com | Charlie Brown | 200            | Blocked |
    And I am on "/admin/customers"
    Then I should see 3 customers
    And customer list should show loyalty points

  @smoke @api
  Scenario: Fetch customers via API
    Given I am authenticated as admin
    When I send GET to "/api/customers"
    Then response status should be 200
    And response should contain array of customers
    And each customer should have fields "id,email,name,loyalty_points,status"

  @regression @e2e @ui
  Scenario: Admin blocks customer account
    Given I am logged in as admin
    And customer exists:
      | email            | status |
      | spam@example.com | Active |
    And I am on "/admin/customers"
    When I click "Block" on customer "spam@example.com"
    And I enter block reason "Fraudulent activity detected"
    And I click "Confirm Block"
    Then customer "spam@example.com" should have status "Blocked"
    And customer should not be able to login
    And I should see success message "Customer blocked successfully"

  @regression @ui
  Scenario: Admin unblocks customer account
    Given I am logged in as admin
    And customer exists:
      | email             | status  |
      | restored@example.com | Blocked |
    And I am on "/admin/customers"
    When I click "Unblock" on customer "restored@example.com"
    And I click "Confirm Unblock"
    Then customer "restored@example.com" should have status "Active"
    And customer should be able to login

  @regression @ui
  Scenario: Admin toggles loyalty program for customer
    Given I am logged in as admin
    And customer exists:
      | email              | loyalty_enabled |
      | member@example.com | true            |
    And I am on "/admin/customers/member@example.com"
    When I toggle "Loyalty Program" to disabled
    And I click "Save Changes"
    Then customer "member@example.com" should have loyalty_enabled false
    And customer should not earn loyalty points on future orders

  @smoke @ui
  Scenario: Admin adds notes to customer account
    Given I am logged in as admin
    And customer exists:
      | email             |
      | vip@example.com   |
    And I am on "/admin/customers/vip@example.com"
    When I click "Add Note"
    And I enter note text "Customer requested gluten-free options"
    And I click "Save Note"
    Then note should be saved with timestamp
    And I should see note "Customer requested gluten-free options" in notes section

  @regression @ui
  Scenario: Admin views customer order history
    Given I am logged in as admin
    And customer "frequent@example.com" has orders:
      | order_id | date       | total  | status    |
      | ORD-601  | 2024-01-10 | 45.99  | Delivered |
      | ORD-602  | 2024-01-15 | 32.50  | Delivered |
      | ORD-603  | 2024-01-20 | 78.20  | Paid      |
    And I am on "/admin/customers/frequent@example.com"
    When I click "Order History" tab
    Then I should see 3 orders
    And total spent should be "156.69"
    And average order value should be "52.23"

  @regression @ui
  Scenario: Admin searches customers by email or name
    Given I am logged in as admin
    And customers exist:
      | email              | name         |
      | john@example.com   | John Doe     |
      | jane@example.com   | Jane Smith   |
      | johnny@example.com | Johnny Cash  |
    And I am on "/admin/customers"
    When I enter "john" in search field
    And I click "Search"
    Then I should see 2 customers
    And I should see "john@example.com" and "johnny@example.com"

  @e2e @ui
  Scenario: Admin manually adjusts customer loyalty points
    Given I am logged in as admin
    And customer exists:
      | email              | loyalty_points |
      | adjust@example.com | 100            |
    And I am on "/admin/customers/adjust@example.com"
    When I click "Adjust Points"
    And I enter adjustment amount "50"
    And I select adjustment type "Add"
    And I enter reason "Compensation for late delivery"
    And I click "Apply Adjustment"
    Then customer "adjust@example.com" should have loyalty_points 150
    And adjustment should be logged in customer history

Feature: Promotions Management Admin
  As an admin
  I want to create and manage promotional campaigns
  So that I can drive sales and customer engagement

  @smoke @e2e @ui
  Scenario: Admin creates BOGO promotion
    Given I am logged in as admin
    And I am on "/admin/promotions"
    When I click "Create Promotion"
    And I select promotion type "BOGO"
    And I fill in promotion details:
      | field        | value                    |
      | name         | Buy One Get One Free Bread |
      | code         | BOGOBREAD                |
      | start_date   | 2024-02-01               |
      | end_date     | 2024-02-29               |
    And I select product "Bread" for BOGO offer
    And I set discount "100%" on second item
    And I click "Save Promotion"