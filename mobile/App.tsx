// Expo / React Native Mobile App Scaffold (G-173)
// Install: npx create-expo-app GroceryOSApp --template blank-typescript
// Run: npx expo start

import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator }   from "@react-navigation/bottom-tabs";
import React, { useState, useEffect }  from "react";
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  Image, StyleSheet, ScrollView, SafeAreaView, StatusBar,
  ActivityIndicator, Alert, Platform,
} from "react-native";

const API_BASE = "https://groceryos.example.com/api";
const Stack    = createNativeStackNavigator();
const Tab      = createBottomTabNavigator();

// ── Shared theme ──────────────────────────────────────────────────────────────
const theme = {
  primary:   "#7c3aed",
  bg:        "#f8fafc",
  card:      "#ffffff",
  text:      "#1e293b",
  muted:     "#64748b",
  border:    "#e2e8f0",
  success:   "#16a34a",
};

// ── Home Screen ───────────────────────────────────────────────────────────────
function HomeScreen({ navigation }: any) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/products?limit=20`)
      .then(r => r.json())
      .then(d => { setProducts(d.products ?? d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search groceries..."
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          accessibilityLabel="Search products"
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => String(i.id)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.productCard}
              onPress={() => navigation.navigate("Product", { product: item })}
              accessibilityLabel={`${item.name}, £${item.price}`}
            >
              <Text style={styles.productEmoji}>🛒</Text>
              <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.productUnit}>{item.unit}</Text>
              <Text style={styles.productPrice}>£{item.price?.toFixed(2)}</Text>
              <TouchableOpacity style={styles.addBtn} accessibilityLabel={`Add ${item.name} to cart`}>
                <Text style={styles.addBtnText}>+ Add</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ── Product Detail Screen ─────────────────────────────────────────────────────
function ProductScreen({ route, navigation }: any) {
  const { product } = route.params;
  const [qty, setQty] = useState(1);

  const addToCart = () => Alert.alert("Added to Cart", `${qty}× ${product.name} added!`);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.productDetail}>
        <Text style={{ fontSize: 80, textAlign: "center", marginVertical: 20 }}>🛒</Text>
        <Text style={styles.detailName}>{product.name}</Text>
        <Text style={styles.detailCategory}>{product.category}</Text>
        <Text style={styles.detailPrice}>£{product.price?.toFixed(2)} / {product.unit}</Text>
        <Text style={styles.detailStock}>In Stock: {product.stock} {product.unit}</Text>

        <View style={styles.qtyRow}>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty(Math.max(1, qty - 1))} accessibilityLabel="Decrease quantity">
            <Text style={styles.qtyBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.qtyValue}>{qty}</Text>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty(qty + 1)} accessibilityLabel="Increase quantity">
            <Text style={styles.qtyBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.ctaBtn} onPress={addToCart} accessibilityLabel={`Add ${qty} ${product.name} to cart`}>
          <Text style={styles.ctaBtnText}>Add to Cart — £{(product.price * qty).toFixed(2)}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ── Orders Screen ─────────────────────────────────────────────────────────────
function OrdersScreen() {
  const [orderId, setOrderId] = useState("");
  const [phone,   setPhone]   = useState("");
  const [order,   setOrder]   = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const trackOrder = async () => {
    if (!orderId || !phone) return Alert.alert("Required", "Please enter order ID and phone number");
    setLoading(true);
    const res  = await fetch(`${API_BASE}/orders/track?orderId=${orderId}&phone=${encodeURIComponent(phone)}`);
    const data = await res.json();
    setOrder(data.order ?? data);
    setLoading(false);
  };

  const statusEmoji: Record<string, string> = { new: "✅", processing: "⚙️", dispatched: "🚚", delivered: "🏠", cancelled: "❌" };

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ padding: 20 }}>
        <Text style={styles.sectionTitle}>Track Your Order</Text>
        <TextInput style={styles.input} placeholder="Order ID" value={orderId} onChangeText={setOrderId} keyboardType="numeric" accessibilityLabel="Order ID" />
        <TextInput style={styles.input} placeholder="Phone Number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" accessibilityLabel="Phone number" />
        <TouchableOpacity style={styles.ctaBtn} onPress={trackOrder} accessibilityLabel="Track order">
          <Text style={styles.ctaBtnText}>{loading ? "Tracking..." : "Track Order"}</Text>
        </TouchableOpacity>
        {order && (
          <View style={styles.orderCard}>
            <Text style={styles.orderTitle}>{statusEmoji[order.status]} Order #{order.id}</Text>
            <Text style={styles.orderStatus}>Status: {order.status?.toUpperCase()}</Text>
            <Text style={styles.orderTotal}>Total: £{order.total?.toFixed(2)}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Account Screen ────────────────────────────────────────────────────────────
function AccountScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={{ padding: 24 }}>
        <Text style={styles.sectionTitle}>My Account</Text>
        {[
          { icon: "❤️", label: "Wishlist" },
          { icon: "🎁", label: "Loyalty Points" },
          { icon: "🔔", label: "Notifications" },
          { icon: "📦", label: "Order History" },
          { icon: "🔒", label: "Security (MFA)" },
          { icon: "🌿", label: "Sustainability" },
        ].map(item => (
          <TouchableOpacity key={item.label} style={styles.menuItem} accessibilityLabel={item.label}>
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={{ color: theme.muted }}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

// ── Bottom Tab Navigator ──────────────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ tabBarActiveTintColor: theme.primary, tabBarStyle: { borderTopColor: theme.border } }}>
      <Tab.Screen name="Shop"    component={HomeScreen}   options={{ tabBarLabel: "Shop",   tabBarIcon: () => <Text>🛒</Text>, headerShown: false }} />
      <Tab.Screen name="Orders"  component={OrdersScreen} options={{ tabBarLabel: "Orders", tabBarIcon: () => <Text>📦</Text> }} />
      <Tab.Screen name="Account" component={AccountScreen}options={{ tabBarLabel: "Account",tabBarIcon: () => <Text>👤</Text> }} />
    </Tab.Navigator>
  );
}

// ── Root Navigator ────────────────────────────────────────────────────────────
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Main"    component={MainTabs}      options={{ headerShown: false }} />
        <Stack.Screen name="Product" component={ProductScreen} options={{ title: "Product", headerStyle: { backgroundColor: theme.primary }, headerTintColor: "#fff" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: theme.bg },
  searchBar:      { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", margin: 12, borderRadius: 12, paddingHorizontal: 14, elevation: 2, shadowColor: "#000", shadowOpacity: .06, shadowRadius: 4 },
  searchIcon:     { fontSize: 18, marginRight: 8 },
  searchInput:    { flex: 1, height: 44, fontSize: 15 },
  row:            { justifyContent: "space-between" },
  productCard:    { flex: 0.48, backgroundColor: theme.card, borderRadius: 14, padding: 12, marginBottom: 12, elevation: 2, shadowColor: "#000", shadowOpacity: .05, shadowRadius: 4 },
  productEmoji:   { fontSize: 40, textAlign: "center", marginBottom: 6 },
  productName:    { fontWeight: "700", fontSize: 13, color: theme.text, marginBottom: 2 },
  productUnit:    { fontSize: 11, color: theme.muted },
  productPrice:   { fontSize: 17, fontWeight: "800", color: theme.primary, marginVertical: 6 },
  addBtn:         { backgroundColor: theme.primary, borderRadius: 8, padding: 8, alignItems: "center" },
  addBtnText:     { color: "#fff", fontWeight: "700", fontSize: 13 },
  productDetail:  { backgroundColor: theme.card, margin: 16, borderRadius: 16, padding: 20 },
  detailName:     { fontSize: 22, fontWeight: "800", color: theme.text, textAlign: "center" },
  detailCategory: { fontSize: 14, color: theme.muted, textAlign: "center", marginBottom: 12 },
  detailPrice:    { fontSize: 26, fontWeight: "800", color: theme.primary, textAlign: "center" },
  detailStock:    { fontSize: 12, color: theme.muted, textAlign: "center", marginVertical: 8 },
  qtyRow:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24, marginVertical: 20 },
  qtyBtn:         { backgroundColor: "#ede9fe", borderRadius: 10, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  qtyBtnText:     { fontSize: 22, fontWeight: "700", color: theme.primary },
  qtyValue:       { fontSize: 24, fontWeight: "800", color: theme.text },
  ctaBtn:         { backgroundColor: theme.primary, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
  ctaBtnText:     { color: "#fff", fontWeight: "800", fontSize: 16 },
  sectionTitle:   { fontSize: 22, fontWeight: "800", color: theme.text, marginBottom: 16 },
  input:          { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 15, borderWidth: 1, borderColor: theme.border },
  orderCard:      { backgroundColor: theme.card, borderRadius: 12, padding: 16, marginTop: 16 },
  orderTitle:     { fontSize: 18, fontWeight: "700" },
  orderStatus:    { fontSize: 14, color: theme.muted, marginTop: 4 },
  orderTotal:     { fontSize: 18, fontWeight: "800", color: theme.primary, marginTop: 8 },
  menuItem:       { flexDirection: "row", alignItems: "center", backgroundColor: theme.card, padding: 16, borderRadius: 12, marginBottom: 8 },
  menuIcon:       { fontSize: 22, marginRight: 14 },
  menuLabel:      { flex: 1, fontSize: 16, fontWeight: "500", color: theme.text },
});
