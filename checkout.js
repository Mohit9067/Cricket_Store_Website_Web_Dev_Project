// Checkout and Payment Processing
class CheckoutManager {
    constructor() {
        this.cart = new ShoppingCart();
        // Razorpay Test Key - For production, get your key from https://dashboard.razorpay.com/
        // This is a demo key - it will open Razorpay test mode
        this.razorpayKey = 'rzp_test_1DP5mmOlF5G5ag'; // Demo test key for testing
    }

    // Initialize checkout page
    initCheckout() {
        this.displayOrderSummary();
        this.setupFormValidation();
        this.setupPaymentButton();
    }

    // Display order summary
    displayOrderSummary() {
        const cartItems = this.cart.getCart();
        const summaryContainer = document.getElementById('order-summary');
        
        if (!summaryContainer) return;

        if (cartItems.length === 0) {
            summaryContainer.innerHTML = `
                <div class="empty-cart">
                    <i class="fas fa-shopping-cart"></i>
                    <h3>Your cart is empty</h3>
                    <a href="index.html" class="btn btn-primary">Continue Shopping</a>
                </div>
            `;
            return;
        }

        let itemsHTML = cartItems.map(item => `
            <div class="order-item">
                <img src="${item.image}" alt="${item.name}" class="order-item-image">
                <div class="order-item-details">
                    <h6>${item.name}</h6>
                    <p class="text-muted small">${item.brand}</p>
                </div>
                <div class="order-item-quantity">x${item.quantity}</div>
                <div class="order-item-price">${formatCurrency(item.price * item.quantity)}</div>
            </div>
        `).join('');

        const subtotal = this.cart.getCartTotal();
        const shipping = subtotal > 1000 ? 0 : 100;
        const tax = subtotal * 0.18; // 18% GST
        const total = subtotal + shipping + tax;

        summaryContainer.innerHTML = `
            <div class="order-items-list">
                ${itemsHTML}
            </div>
            <div class="order-totals">
                <div class="total-row">
                    <span>Subtotal</span>
                    <span>${formatCurrency(subtotal)}</span>
                </div>
                <div class="total-row">
                    <span>Shipping</span>
                    <span>${shipping === 0 ? 'FREE' : formatCurrency(shipping)}</span>
                </div>
                <div class="total-row">
                    <span>GST (18%)</span>
                    <span>${formatCurrency(tax)}</span>
                </div>
                <div class="total-row total-final">
                    <span>Total</span>
                    <span>${formatCurrency(total)}</span>
                </div>
            </div>
        `;

        // Store total for payment
        this.orderTotal = total;
    }

    // Setup form validation
    setupFormValidation() {
        const form = document.getElementById('checkout-form');
        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (this.validateForm()) {
                this.processPayment();
            }
        });
    }

    // Validate checkout form
    validateForm() {
        const form = document.getElementById('checkout-form');
        const inputs = form.querySelectorAll('input[required], select[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (!input.value.trim()) {
                isValid = false;
                input.classList.add('is-invalid');
            } else {
                input.classList.remove('is-invalid');
            }
        });

        // Email validation
        const email = form.querySelector('input[type="email"]');
        if (email && email.value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.value)) {
                isValid = false;
                email.classList.add('is-invalid');
            }
        }

        // Phone validation
        const phone = form.querySelector('input[type="tel"]');
        if (phone && phone.value) {
            const phoneRegex = /^[6-9]\d{9}$/;
            if (!phoneRegex.test(phone.value.replace(/\s/g, ''))) {
                isValid = false;
                phone.classList.add('is-invalid');
            }
        }

        return isValid;
    }

    // Get billing details
    getBillingDetails() {
        const form = document.getElementById('checkout-form');
        return {
            name: form.querySelector('[name="name"]').value,
            email: form.querySelector('[name="email"]').value,
            phone: form.querySelector('[name="phone"]').value,
            address: form.querySelector('[name="address"]').value,
            city: form.querySelector('[name="city"]').value,
            state: form.querySelector('[name="state"]').value,
            pincode: form.querySelector('[name="pincode"]').value
        };
    }

    // Setup payment button
    setupPaymentButton() {
        const payButton = document.getElementById('pay-now-btn');
        if (payButton) {
            payButton.addEventListener('click', () => {
                const form = document.getElementById('checkout-form');
                form.dispatchEvent(new Event('submit'));
            });
        }
    }

    // Process payment with Razorpay
    processPayment() {
        const billingDetails = this.getBillingDetails();
        const cartItems = this.cart.getCart();

        if (cartItems.length === 0) {
            this.showNotification('Your cart is empty!', 'danger');
            return;
        }

        // Create order description
        const orderDescription = cartItems.map(item => 
            `${item.name} x${item.quantity}`
        ).join(', ');

        // Show loading state
        const payButton = document.getElementById('pay-now-btn');
        const originalText = payButton.innerHTML;
        payButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Opening Razorpay...</span>';
        payButton.disabled = true;

        try {
            const options = {
                key: this.razorpayKey,
                amount: Math.round(this.orderTotal * 100), // Amount in paise
                currency: 'INR',
                name: 'Cricket Store',
                description: orderDescription,
                image: 'https://via.placeholder.com/150x150/FFD700/000000?text=Cricket+Store',
                prefill: {
                    name: billingDetails.name,
                    email: billingDetails.email,
                    contact: billingDetails.phone
                },
                notes: {
                    address: billingDetails.address,
                    city: billingDetails.city,
                    state: billingDetails.state,
                    pincode: billingDetails.pincode
                },
                theme: {
                    color: '#FFD700'
                },
                handler: (response) => {
                    this.handlePaymentSuccess(response, billingDetails);
                },
                modal: {
                    ondismiss: () => {
                        payButton.innerHTML = originalText;
                        payButton.disabled = false;
                        this.showNotification('Payment cancelled by user', 'warning');
                    },
                    confirm_close: true
                }
            };

            if (typeof Razorpay === 'undefined') {
                throw new Error('Razorpay SDK not loaded');
            }

            const razorpay = new Razorpay(options);
            razorpay.on('payment.failed', (response) => {
                payButton.innerHTML = originalText;
                payButton.disabled = false;
                this.showNotification('Payment failed: ' + response.error.description, 'danger');
            });
            
            razorpay.open();
            
            // Reset button after modal closes
            setTimeout(() => {
                payButton.innerHTML = originalText;
                payButton.disabled = false;
            }, 1000);
            
        } catch (error) {
            payButton.innerHTML = originalText;
            payButton.disabled = false;
            console.error('Payment error:', error);
            this.showNotification('Error initializing payment: ' + error.message, 'danger');
        }
    }

    // Handle successful payment
    handlePaymentSuccess(paymentResponse, billingDetails) {
        console.log('Payment successful:', paymentResponse);
        
        // Create order object
        const order = {
            orderId: 'CKT' + Date.now(),
            paymentId: paymentResponse.razorpay_payment_id,
            signature: paymentResponse.razorpay_signature || 'N/A',
            items: this.cart.getCart(),
            subtotal: this.cart.getCartTotal(),
            shipping: this.cart.getCartTotal() > 1000 ? 0 : 100,
            tax: this.cart.getCartTotal() * 0.18,
            total: this.orderTotal,
            billingDetails: billingDetails,
            orderDate: new Date().toISOString(),
            orderDateFormatted: new Date().toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }),
            status: 'Confirmed',
            paymentMethod: 'Razorpay'
        };

        // Save order to localStorage
        this.saveOrder(order);

        // Show success notification
        this.showNotification('Payment successful! Redirecting...', 'success');

        // Clear cart
        this.cart.clearCart();

        // Redirect to success page after a short delay
        setTimeout(() => {
            window.location.href = `success.html?orderId=${order.orderId}`;
        }, 1500);
    }

    // Save order
    saveOrder(order) {
        let orders = JSON.parse(localStorage.getItem('cricketStoreOrders') || '[]');
        orders.push(order);
        localStorage.setItem('cricketStoreOrders', JSON.stringify(orders));
    }

    // Show notification
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} position-fixed top-0 start-50 translate-middle-x mt-3`;
        notification.style.zIndex = '9999';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }
}

// Initialize checkout on page load
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('checkout-form')) {
        const checkout = new CheckoutManager();
        checkout.initCheckout();
    }
});
