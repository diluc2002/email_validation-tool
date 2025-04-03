require('dotenv').config();
const express = require('express');
const MailosaurClient = require('mailosaur');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const winston = require('winston');
const cors = require('cors');
const path = require('path');
const app = express();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console(),
  ],
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/validate-email', limiter);

const mailosaur = new MailosaurClient(process.env.MAILOSAUR_API_KEY);
const mailinatorApiKey = process.env.MAILINATOR_API_KEY;
const mailinatorApiUrl = 'https://api.mailinator.com/api/v2/domain';

const blacklistedPatterns = [/invalid/, /test/, /fake/, /noreply/, /donotreply/];

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

app.post('/validate-email', [
    body('email').trim().isEmail().normalizeEmail().withMessage('Invalid email format.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn('Validation error', { errors: errors.array(), ip: req.ip });
        return res.status(400).json({ valid: false, message: errors.array()[0].msg, details: {} });
    }

    const email = req.body.email;
    const domain = email.split('@')[1]?.toLowerCase();
    const localPart = email.split('@')[0]?.toLowerCase();

    // Blacklist Check
    if (blacklistedPatterns.some(pattern => pattern.test(localPart))) {
        return res.json({
            valid: false,
            message: 'This email appears to be invalid or potentially false.',
            details: {},
        });
    }

    const freeEmailDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'];
    const disposableEmailDomains = ['mailinator.com', 'tempmail.com', 'guerrillamail.com', '10minutemail.com'];
    const roleBasedPrefixes = ['admin', 'support', 'info', 'sales', 'contact', 'team'];

    const details = {
        isFreeEmail: freeEmailDomains.includes(domain),
        isDisposableEmail: disposableEmailDomains.includes(domain),
        isRoleBasedEmail: roleBasedPrefixes.some(prefix => localPart.startsWith(prefix)),
        domain: domain,
    };

    try {
        // Validate domain with Mailinator API
        let isDomainValid = true;
        if (mailinatorApiKey) {
            const response = await fetch(`${mailinatorApiUrl}?domain=${encodeURIComponent(domain)}&key=${mailinatorApiKey}`);
            const data = await response.json();
            isDomainValid = !data.disposable;
        }

        if (!isDomainValid) {
            return res.json({
                valid: false,
                message: 'Domain is associated with disposable or fake email services.',
                details,
            });
        }

        // Simulate validation with Mailosaur (if enabled)
        let testEmailAddress = null;
        if (process.env.MAILOSAUR_SERVER_ID) {
            testEmailAddress = `test-${Math.random().toString(36).substring(2, 15)}@${process.env.MAILOSAUR_SERVER_ID}.mailosaur.net`;
        }

        res.json({
            valid: true,
            message: 'Email is valid and recognized.',
            details: {
                ...details,
                test_email_address: testEmailAddress,
                simulated_validation: Boolean(testEmailAddress),
            },
        });
    } catch (error) {
        logger.error('Validation Error', { error: error.message, email, ip: req.ip });
        res.json({
            valid: false,
            message: 'Email validation failed.',
            details: { error: error.message },
        });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  logger.info(`Server running at port ${port}`);
});
