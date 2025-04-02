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

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

app.post(
  '/validate-email',
  [
    body('email').trim().isEmail().normalizeEmail().withMessage('Invalid email format.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation error', { errors: errors.array(), ip: req.ip });
      return res.status(400).json({
        valid: false,
        message: errors.array()[0].msg,
        details: {},
      });
    }

    const email = req.body.email;
    const mailosaurServerId = process.env.MAILOSAUR_SERVER_ID;

    if (!process.env.MAILOSAUR_API_KEY || !mailosaurServerId) {
      logger.error('Mailosaur API key or server ID missing in .env file');
      return res.status(500).json({
        valid: false,
        message: 'Server configuration error: API keys missing.',
        details: {},
      });
    }

    try {
      const domain = email.split('@')[1].toLowerCase();
      const freeEmailDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'];
      const disposableEmailDomains = ['mailinator.com', 'tempmail.com', 'guerrillamail.com', '10minutemail.com'];
      const roleBasedPrefixes = ['admin', 'support', 'info', 'sales', 'contact', 'team'];

      const details = {
        isFreeEmail: freeEmailDomains.includes(domain),
        isDisposableEmail: disposableEmailDomains.includes(domain),
        isRoleBasedEmail: roleBasedPrefixes.some(prefix => email.toLowerCase().startsWith(`${prefix}@`)),
        domain: domain,
      };

      const testEmailAddress = `test-${Math.random().toString(36).substring(2, 15)}@${mailosaurServerId}.mailosaur.net`;
      const domainCheck = await mailosaur.servers.get(mailosaurServerId);
      const isDomainValid = domainCheck ? true : false;

      if (!isDomainValid) {
        throw new Error('Invalid domain according to Mailosaur.');
      }

      res.json({
        valid: true,
        message: 'Email format is valid.',
        details: {
          ...details,
          test_email_address: testEmailAddress,
          simulated_validation: true,
        },
      });
    } catch (error) {
      logger.error('Validation Error', { error: error.message, email, ip: req.ip });
      res.json({
        valid: false,
        message: 'Email validation failed.',
        details: {
          error: error.message,
        },
      });
    }
  }
);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  logger.info(`Server running at port ${port}`);
});