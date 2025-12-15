// Simple Checkout JavaScript

let currentTab = 'card';
let quantity = 2;
const unitPrice = 100;
let currentCurrency = 'HKD';
const exchangeRate = 0.11; // 1 HKD = 0.11 EUR (approximate)

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    updateTotals();
    setupCardFormatting();
    checkServerConnection();
});

// Check if server is running
async function checkServerConnection() {
    try {
        const response = await fetch('/health');
        if (!response.ok) {
            throw new Error('Server health check failed');
        }
        const result = await response.json();
        console.log('✅ Server status:', result.status);
        
        // Test the API endpoint
        const testResponse = await fetch('/api/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ test: 'data' })
        });
        const testResult = await testResponse.json();
        console.log('✅ API test:', testResult.message);
        
    } catch (error) {
        console.error('❌ Server connection error:', error);
        showMessage('Warning: Server may not be running. Please start the server with "npm start"', 'error');
    }
}

// Update quantity
function updateQuantity(change) {
    quantity = Math.max(1, quantity + change);
    document.getElementById('quantity').textContent = quantity;
    updateTotals();
}

// Update order totals
function updateTotals() {
    const subtotal = quantity * unitPrice;
    const total = subtotal; // No shipping or tax

    // Update item price display
    let displaySubtotal, displayTotal;
    let currencySymbol;

    if (currentCurrency === 'EUR') {
        // Convert to EUR and keep 2 decimal places
        displaySubtotal = (subtotal * exchangeRate).toFixed(2);
        displayTotal = (total * exchangeRate).toFixed(2);
        currencySymbol = '€';
    } else {
        // Keep HKD as decimal
        displaySubtotal = subtotal.toFixed(2);
        displayTotal = total.toFixed(2);
        currencySymbol = 'HK$';
    }

    // Update item price display
    document.getElementById('item-price').textContent = `${currencySymbol}${displaySubtotal}`;
    document.getElementById('subtotal').textContent = `${currencySymbol}${displaySubtotal}`;
    document.getElementById('total').textContent = `${currencySymbol}${displayTotal}`;
    
    // Update pay button
    document.getElementById('pay-button').textContent = `Complete Payment - ${currencySymbol}${displayTotal}`;
}

// Switch payment tabs
function switchTab(tabName, element) {
    currentTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    element.classList.add('active');
    
    // Update forms
    document.querySelectorAll('.payment-form').forEach(form => {
        form.classList.remove('active');
    });
    document.getElementById(tabName + '-form').classList.add('active');
}

// Setup card number formatting
function setupCardFormatting() {
    const cardNumber = document.getElementById('card-number');
    const cardExpiry = document.getElementById('card-expiry');
    
    cardNumber.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\s/g, '').replace(/\D/g, '');
        let formattedValue = value.replace(/(.{4})/g, '$1 ').trim();
        if (formattedValue !== e.target.value) {
            e.target.value = formattedValue;
        }
    });
    
    cardExpiry.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length >= 2) {
            value = value.substring(0, 2) + '/' + value.substring(2, 4);
        }
        e.target.value = value;
    });
}

// Process payment
async function processPayment() {
    const payButton = document.getElementById('pay-button');
    
    // Validate form
    if (!validateForm()) {
        showMessage('Please fill in all required fields', 'error');
        return;
    }
    
    // Show loading
    showLoading(true);
    payButton.disabled = true;
    
    try {
        // Simulate payment processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (currentTab === 'card') {
            await processCardPayment();
        } else if (currentTab === 'ideal') {
            await processIdealPayment();
        }
        
    } catch (error) {
        console.error('Payment error:', error);
        showMessage(error.message || 'Payment failed. Please try again.', 'error');
    } finally {
        showLoading(false);
        payButton.disabled = false;
    }
}

// Validate current form
function validateForm() {
    if (currentTab === 'card') {
        const cardNumber = document.getElementById('card-number').value;
        const cardExpiry = document.getElementById('card-expiry').value;
        const cardCvv = document.getElementById('card-cvv').value;
        
        return cardNumber.replace(/\s/g, '').length >= 13 && 
               cardExpiry.length === 5 && 
               cardCvv.length >= 3;
    } else if (currentTab === 'ideal') {
        const bank = document.getElementById('ideal-bank').value;
        return bank !== '';
    }
    
    return false;
}

// Process card payment
async function processCardPayment() {
    const cardData = {
        method: 'card',
        number: document.getElementById('card-number').value,
        expiry: document.getElementById('card-expiry').value,
        cvv: document.getElementById('card-cvv').value,
        amount: calculateTotal(),
        currency: currentCurrency
    };
    
    console.log('Processing card payment:', cardData);
    console.log('Sending JSON body:', JSON.stringify(cardData));
    
    try {
        // Make API call to payment endpoint
        const response = await fetch('/api/payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cardData)
        });
        
        if (!response.ok) {
            console.log('Response not OK:', response.status, response.statusText);
            throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Server is not running or returned invalid response. Please make sure the server is started.');
        }
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('Payment successful! Order confirmation sent to your email.', 'success');
            
            // Redirect to success page with payment reference
            setTimeout(() => {
                // Calculate display amount based on current currency
                let displayAmount;
                if (currentCurrency === 'EUR') {
                    displayAmount = (cardData.amount * exchangeRate).toFixed(2);
                } else {
                    displayAmount = cardData.amount.toFixed(2);
                }
                
                const params = new URLSearchParams({
                    method: 'card',
                    amount: displayAmount,
                    currency: currentCurrency,
                    payment_account_reference: result.payment_account_reference || result.paymentId,
                    status: result.status
                });
                window.location.href = `/success.html?${params.toString()}`;
            }, 2000);
        } else {
            throw new Error(result.error || 'Payment failed');
        }
    } catch (error) {
        console.error('Card payment error:', error);
        throw error;
    }
}

// Process iDEAL payment
async function processIdealPayment() {
    const bank = document.getElementById('ideal-bank').value;
    const amount = calculateTotal();
    
    const idealData = {
        method: 'ideal',
        bank: bank,
        amount: amount
    };
    
    console.log('Processing iDEAL payment (redirect):', idealData);
    console.log('Sending JSON body:', JSON.stringify(idealData));
    
    try {
        // Make API call to payment endpoint
        const response = await fetch('/api/payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(idealData)
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Server is not running or returned invalid response. Please make sure the server is started.');
        }
        
        const result = await response.json();
        
        if (result.success && result.redirect_url) {
            showMessage('Redirecting to your bank for authentication...', 'success');
            // Redirect to bank simulation
            setTimeout(() => {
                window.location.href = result.redirect_url;
            }, 2000);
        } else {
            throw new Error('iDEAL redirect failed');
        }
    } catch (error) {
        console.error('iDEAL payment error:', error);
        throw error;
    }
}

// Calculate total amount
function calculateTotal() {
    const subtotal = quantity * unitPrice;
    // Always return HKD amount for server processing
    // Ensure we return a proper number, not a string
    return parseFloat(subtotal.toFixed(2));
}

// Show loading overlay
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

// Show message
function showMessage(text, type) {
    const message = document.getElementById('message');
    message.textContent = text;
    message.className = `message ${type}`;
    message.style.display = 'block';
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        message.style.display = 'none';
    }, 5000);
}

// Close message when clicked
document.getElementById('message').addEventListener('click', function() {
    this.style.display = 'none';
});

// Switch currency
function switchCurrency(currency, element) {
    currentCurrency = currency;
    
    // Update currency tab buttons
    document.querySelectorAll('.currency-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    element.classList.add('active');
    
    // Update totals with new currency
    updateTotals();
}