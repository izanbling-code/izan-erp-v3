"use client";

export default function AddToCartButton({ product }: { product: any }) {
  const handleAdd = () => {
    const saved = localStorage.getItem("izan_cart");
    const cart = saved ? JSON.parse(saved) : [];
    cart.push(product);
    localStorage.setItem("izan_cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("cart-updated"));
    alert(`${product.name} added to cart!`);
  };

  return (
    <button onClick={handleAdd} className="bg-gray-900 text-white py-4 px-8 uppercase tracking-widest text-sm hover:bg-gray-800 transition rounded shadow-lg">
      Add to Cart
    </button>
  );
}
