// src/config/adminjs.config.js
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSMongoose from '@adminjs/mongoose';
import session from 'express-session';
import User from '../models/user.model.js';
import Student from '../models/student.model.js';
import Company from '../models/company.model.js';
import Shortlist from '../models/shortlist.model.js';
import Offer from '../models/offer.model.js';
import { logger } from '../utils/logger.js';

// Register the mongoose adapter
AdminJS.registerAdapter({
  Resource: AdminJSMongoose.Resource,
  Database: AdminJSMongoose.Database,
});

// Simple authentication with fixed credentials from .env
const authenticate = async (email, password) => {
  const adminEmail = process.env.ADMINJS_EMAIL;
  const adminPassword = process.env.ADMINJS_PASSWORD;

  if (!adminEmail || !adminPassword) {
    logger.error('AdminJS credentials not set in environment variables');
    return null;
  }

  if (email === adminEmail && password === adminPassword) {
    logger.info(`AdminJS login successful: ${email}`);
    return { email, id: 'adminjs-user' };
  }

  logger.warn(`AdminJS login failed for: ${email}`);
  return null;
};

// Configure AdminJS
export const setupAdminJS = () => {
  // Compute admin root including BASE_PATH so AdminJS generates correct URLs
  const BASE_PATH = process.env.BASE_PATH || '';
  const adminRoot = BASE_PATH ? `${BASE_PATH}/db-admin` : '/db-admin';

  const adminOptions = {
    resources: [
      {
        resource: User,
        options: {
          parent: {
            name: 'User Management',
            icon: 'User',
          },
          listProperties: ['emailId', 'name', 'role', 'isAllowed', 'createdAt'],
          showProperties: ['emailId', 'name', 'phoneNo', 'role', 'isAllowed', 'providers', 'createdAt', 'updatedAt'],
          editProperties: ['emailId', 'name', 'phoneNo', 'role', 'isAllowed'],
          filterProperties: ['emailId', 'name', 'role', 'isAllowed'],
          sort: {
            sortBy: 'createdAt',
            direction: 'desc',
          },
          actions: {
            delete: {
              // Admins can delete users
              isAccessible: true,
            },
          },
        },
      },
      {
        resource: Student,
        options: {
          parent: {
            name: 'User Management',
            icon: 'User',
          },
          listProperties: ['userId', 'rollNumber', 'isPlaced', 'placedCompany', 'createdAt'],
          showProperties: ['userId', 'rollNumber', 'isPlaced', 'placedCompany', 'shortlistedCompanies', 'waitlistedCompanies', 'createdAt', 'updatedAt'],
          editProperties: ['rollNumber', 'isPlaced', 'placedCompany'],
          filterProperties: ['rollNumber', 'isPlaced', 'placedCompany'],
          properties: {
            userId: {
              isTitle: true,
            },
          },
        },
      },
      {
        resource: Company,
        options: {
          parent: {
            name: 'Company Management',
            icon: 'Building',
          },
          listProperties: ['name', 'venue', 'maxRounds', 'isProcessCompleted', 'createdAt'],
          showProperties: ['name', 'venue', 'maxRounds', 'POCs', 'placedStudents', 'isProcessCompleted', 'createdAt', 'updatedAt'],
          editProperties: ['name', 'venue', 'maxRounds', 'POCs', 'isProcessCompleted'],
          filterProperties: ['name', 'venue', 'isProcessCompleted'],
          properties: {
            name: {
              isTitle: true,
            },
          },
        },
      },
      {
        resource: Shortlist,
        options: {
          parent: {
            name: 'Placement Process',
            icon: 'List',
          },
          listProperties: ['studentId', 'companyId', 'status', 'stage', 'isOffered', 'isStudentPlaced', 'createdAt'],
          showProperties: ['studentId', 'companyId', 'companyName', 'status', 'stage', 'interviewStatus', 'isOffered', 'isStudentPlaced', 'studentPlacedCompany', 'createdAt', 'updatedAt'],
          editProperties: ['status', 'stage', 'interviewStatus', 'isOffered'],
          filterProperties: ['companyId', 'status', 'stage', 'isOffered', 'isStudentPlaced'],
        },
      },
      {
        resource: Offer,
        options: {
          parent: {
            name: 'Placement Process',
            icon: 'Award',
          },
          listProperties: ['studentId', 'companyId', 'approvalStatus', 'offerStatus', 'approvedBy', 'createdAt'],
          showProperties: ['studentId', 'companyId', 'approvalStatus', 'offerStatus', 'approvedBy', 'approvedAt', 'acceptedBy', 'acceptedAt', 'venue', 'remarks', 'createdAt', 'updatedAt'],
          editProperties: ['approvalStatus', 'offerStatus', 'venue', 'remarks'],
          filterProperties: ['companyId', 'approvalStatus', 'offerStatus'],
          sort: {
            sortBy: 'createdAt',
            direction: 'desc',
          },
        },
      },
    ],
    // AdminJS paths: set root/login/logout under adminRoot (includes BASE_PATH when provided)
    rootPath: adminRoot,
    loginPath: `${adminRoot}/login`,
    logoutPath: `${adminRoot}/logout`,
    branding: {
      companyName: 'CCD Placement Portal',
      logo: false,
      softwareBrothers: false,
      withMadeWithLove: false,
    },
    locale: {
      language: 'en',
      translations: {
        en: {
          messages: {
            loginWelcome: 'Admin Panel - CCD Placement System',
          },
        },
      },
    },
  };

  const adminJs = new AdminJS(adminOptions);

  // Watch for changes (hot reload)
  try {
    adminJs.watch();
  } catch (err) {
    logger.error('AdminJS watch error:', err);
  }

  // Build authentication router
  // Provide explicit session options to avoid express-session deprecation warnings
  const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
    adminJs,
    {
      authenticate,
      cookieName: 'adminjs',
      cookiePassword: process.env.JWT_SECRET || 'super-secret-cookie-change-in-production',
    },
    null, // predefined router (null lets AdminJS create an express.Router())
    {
      resave: false,
      saveUninitialized: false,
      secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'super-secret-session',
    }
  );

  logger.info(`AdminJS initialized at ${adminJs.options.rootPath || adminRoot}`);

  return { adminJs, adminRouter };
};
