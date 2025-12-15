// Checkout.com API credentials
const checkoutSecretKey = 'sk_sbox_txpyg4zdo4pvb42jiag4dp4qcye'
const checkoutPublicKey = 'pk_sbox_kms5vhdb66lgxsgzlgv4dgy3ziy'
const processingChannelId = 'pc_2vhgz2ikd6hele43rwcgvwuqju'

const express = require('express')
const app = express()
const axios = require('axios')

app.use(express.json())
app.use(express.static('public'))

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/public/index.html')
})

app.get('/success', function(req, res) {
    res.sendFile(__dirname + '/public/success.html')
})

app.get('/health', function(req, res) {
    res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

// Test endpoint to verify server is working
app.post('/api/test', function(req, res) {
    console.log('TEST ENDPOINT HIT:', req.body)
    res.json({ 
        success: true, 
        message: 'Server is working!',
        received: req.body 
    })
})

app.post('/api/payment', function(req, res) {
    try {
        console.log('=== PAYMENT REQUEST START ===')
        console.log('Full request body:', JSON.stringify(req.body, null, 2))
        
        const { method, number, expiry, cvv, amount, bank, currency } = req.body
        
        console.log('Extracted values:', { 
            method, 
            number: number ? 'PRESENT' : 'MISSING', 
            expiry, 
            cvv: cvv ? 'PRESENT' : 'MISSING', 
            amount: amount, 
            amountType: typeof amount,
            bank, 
            currency 
        })
    
    if (!method) {
        console.log('ERROR: No payment method provided')
        return res.status(400).json({
            success: false,
            error: 'Payment method is required'
        })
    }
    
    if (method === 'card') {
        console.log('Processing CARD payment...')
        
        if (!number || !expiry || !cvv || !amount) {
            console.log('ERROR: Missing card payment fields')
            return res.status(400).json({
                success: false,
                error: 'Missing required card fields'
            })
        }
        // Parse expiry date (MM/YY format)
        console.log('Parsing expiry date:', expiry)
        const expiryParts = expiry.split('/')
        if (expiryParts.length !== 2) {
            console.log('ERROR: Invalid expiry format')
            return res.status(400).json({
                success: false,
                error: 'Invalid expiry date format. Expected MM/YY'
            })
        }
        
        const [month, year] = expiryParts
        const monthInt = parseInt(month)
        const yearInt = parseInt(year)
        const fullYear = 2000 + yearInt
        
        console.log('Parsed expiry:', { month: monthInt, year: fullYear })
        
        if (isNaN(monthInt) || monthInt < 1 || monthInt > 12) {
            console.log('ERROR: Invalid month')
            return res.status(400).json({
                success: false,
                error: 'Invalid month in expiry date'
            })
        }
        
        if (isNaN(yearInt) || fullYear < 2024) {
            console.log('ERROR: Invalid year')
            return res.status(400).json({
                success: false,
                error: 'Invalid year in expiry date'
            })
        }
        
        // Determine currency and amount
        const paymentCurrency = currency || "HKD"
        let finalAmount = parseFloat(amount)
        
        // Validate amount is a valid number
        if (isNaN(finalAmount) || finalAmount <= 0) {
            console.log('ERROR: Invalid amount before conversion:', amount)
            return res.status(400).json({
                success: false,
                error: 'Invalid amount provided'
            })
        }
        
        // If EUR is selected, convert from HKD to EUR
        if (paymentCurrency === "EUR") {
            finalAmount = parseFloat((finalAmount * 0.11).toFixed(2)) // 1 HKD = 0.11 EUR, keep 2 decimals
        }
        
        // Convert amount to cents (integer) - Checkout.com requires integer amounts
        // Use Math.round to handle floating point precision issues
        const amountInCents = Math.round(finalAmount * 100)
        console.log(`💰 Amount conversion: ${amount} ${currency || 'HKD'} -> ${finalAmount} ${paymentCurrency} -> ${amountInCents} cents`)
        
        if (isNaN(amountInCents) || amountInCents <= 0) {
            console.log('ERROR: Invalid amount in cents:', amountInCents, 'from original amount:', amount)
            return res.status(400).json({
                success: false,
                error: 'Invalid amount - must be a positive number'
            })
        }
        
        const paymentData = {
            source: {
                type: "card",
                number: number.replace(/\s/g, ''),
                expiry_month: monthInt,
                expiry_year: fullYear,
                cvv: parseInt(cvv)
            },
            amount: amountInCents,
            currency: paymentCurrency,
            reference: `test_cko_lp_${Date.now()}`,
            capture: false,
            "3ds": {
                enabled: false,
                attempt_n3d: false
            },
            processing_channel_id: processingChannelId,
            metadata: {
                udf4: "IE Test"
            }
        }
        
        console.log('Calling Checkout.com API with data:', JSON.stringify(paymentData, null, 2))
        console.log('Using secret key:', checkoutSecretKey.substring(0, 10) + '...')
        console.log('API URL: https://api.sandbox.checkout.com/payments')
        console.log('Headers:', {
            'Authorization': `Bearer ${checkoutSecretKey.substring(0, 10)}...`,
            'Content-Type': 'application/json'
        })
        
        axios.post('https://api.sandbox.checkout.com/payments', paymentData, {
            headers: {
                'Authorization': `Bearer ${checkoutSecretKey}`,
                'Content-Type': 'application/json'
            },
            httpsAgent: new (require('https').Agent)({
                rejectUnauthorized: false // Only for development/sandbox
            })
        }).then(function(response) {
            console.log('✅ CHECKOUT.COM API SUCCESS')
            console.log('Response status:', response.status)
            console.log('Response data:', JSON.stringify(response.data, null, 2))
            
            res.json({
                success: true,
                paymentId: response.data.id,
                payment_account_reference: response.data.source?.payment_account_reference || response.data.reference,
                status: response.data.status,
                approved: response.data.approved
            })
        }).catch(function(error) {
            console.log('❌ CHECKOUT.COM API ERROR')
            console.log('Error status:', error.response?.status)
            console.log('Error message:', error.message)
            console.log('Error data:', JSON.stringify(error.response?.data, null, 2))
            
            res.status(error.response?.status || 500).json({
                success: false,
                error: 'Payment processing failed',
                details: error.response?.data || error.message
            })
        })
        
    } else if (method === 'ideal') {
        console.log('Processing iDEAL payment (simple redirect)...')
        
        if (!bank || !amount) {
            console.log('ERROR: Missing iDEAL payment fields')
            return res.status(400).json({
                success: false,
                error: 'Missing required iDEAL fields'
            })
        }
        
        // Validate amount for iDEAL
        const idealAmount = parseFloat(amount)
        if (isNaN(idealAmount) || idealAmount <= 0) {
            console.log('ERROR: Invalid iDEAL amount:', amount)
            return res.status(400).json({
                success: false,
                error: 'Invalid amount for iDEAL payment'
            })
        }
        
        console.log(`💰 iDEAL Payment: HK$${idealAmount.toFixed(2)} via ${bank}`)
        
        // Simple redirect - no API call needed
        const paymentReference = `ideal_${Date.now()}`
        const redirectUrl = `https://ideal-simulator.com/payment?amount=${idealAmount.toFixed(2)}&bank=${bank}&ref=${paymentReference}&return_url=${encodeURIComponent(req.protocol + '://' + req.get('host') + '/success')}`
        
        console.log('✅ iDEAL Redirect Created:', redirectUrl)
        
        res.json({
            success: true,
            paymentId: paymentReference,
            payment_account_reference: paymentReference,
            status: 'redirect_pending',
            redirect_url: redirectUrl
        })
    } else {
        console.log('ERROR: Unsupported payment method:', method)
        return res.status(400).json({
            success: false,
            error: `Unsupported payment method: ${method}`
        })
    }
    
        console.log('=== PAYMENT REQUEST END ===')
    } catch (error) {
        console.log('❌ UNEXPECTED SERVER ERROR')
        console.error('Error details:', error)
        console.error('Error stack:', error.stack)
        console.error('Request body that caused error:', JSON.stringify(req.body, null, 2))
        
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        })
    }
})

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`)
    console.log('📱 iPhone Cases Checkout is ready!')
})