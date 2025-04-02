const request = require('supertest');
const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const MailosaurClient = require('mailosaur');

// Create a mock function for servers.get and mock MailosaurClient
const mockGet = jest.fn();
jest.mock('mailosaur', () => {
  return jest.fn().mockImplementation(() => ({
    servers: {
      get: mockGet,
    },
  }));
});

const app = express();

app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/validate-email', limiter);

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
      return res.status(400).json({
        valid: false,
        message: errors.array()[0].msg,
        details: {},
      });
    }

    const email = req.body.email;
    const mailosaurServerId = 'mock-server-id';

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
      const domainCheck = await mockGet(mailosaurServerId);
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

describe('Email Validation API', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('should return 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/validate-email')
      .send({ email: 'invalid-email' });
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      valid: false,
      message: 'Invalid email format.',
      details: {},
    });
  });

  it('should identify a free email', async () => {
    mockGet.mockResolvedValue({ id: 'mock-server-id' });
    const res = await request(app)
      .post('/validate-email')
      .send({ email: 'test@gmail.com' });
    expect(res.statusCode).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.message).toBe('Email format is valid.');
    expect(res.body.details.isFreeEmail).toBe(true);
    expect(res.body.details.isDisposableEmail).toBe(false);
    expect(res.body.details.isRoleBasedEmail).toBe(false);
    expect(res.body.details.domain).toBe('gmail.com');
  });

  it('should identify a disposable email', async () => {
    mockGet.mockResolvedValue({ id: 'mock-server-id' });
    const res = await request(app)
      .post('/validate-email')
      .send({ email: 'test@mailinator.com' });
    expect(res.statusCode).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.details.isFreeEmail).toBe(false);
    expect(res.body.details.isDisposableEmail).toBe(true);
    expect(res.body.details.isRoleBasedEmail).toBe(false);
    expect(res.body.details.domain).toBe('mailinator.com');
  });

  it('should identify a role-based email', async () => {
    mockGet.mockResolvedValue({ id: 'mock-server-id' });
    const res = await request(app)
      .post('/validate-email')
      .send({ email: 'admin@yourcompany.com' });
    expect(res.statusCode).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.details.isFreeEmail).toBe(false);
    expect(res.body.details.isDisposableEmail).toBe(false);
    expect(res.body.details.isRoleBasedEmail).toBe(true);
    expect(res.body.details.domain).toBe('yourcompany.com');
  });

  it('should identify a custom email', async () => {
    mockGet.mockResolvedValue({ id: 'mock-server-id' });
    const res = await request(app)
      .post('/validate-email')
      .send({ email: 'diptangshu@yourcompany.com' });
    expect(res.statusCode).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.details.isFreeEmail).toBe(false);
    expect(res.body.details.isDisposableEmail).toBe(false);
    expect(res.body.details.isRoleBasedEmail).toBe(false);
    expect(res.body.details.domain).toBe('yourcompany.com');
  });

  it('should return 200 for health check', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.message).toBe('Server is running');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('should return 429 when rate limit is exceeded', async () => {
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/validate-email')
        .send({ email: 'test@example.com' });
    }

    const res = await request(app)
      .post('/validate-email')
      .send({ email: 'test@example.com' });
    expect(res.statusCode).toBe(429);
    expect(res.text).toBe('Too many requests from this IP, please try again later.');
  });

  it('should handle Mailosaur server get failure', async () => {
    mockGet.mockRejectedValue(new Error('Mailosaur server error'));
    const res = await request(app)
      .post('/validate-email')
      .send({ email: 'test@gmail.com' });
    expect(res.statusCode).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.message).toBe('Email validation failed.');
    expect(res.body.details.error).toBe('Mailosaur server error');
  });
});