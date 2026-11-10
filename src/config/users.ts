export interface AllowedUserConfig {
  email: string;
  /**
   * @deprecated Prefer `passwordHash`. Plaintext demo passwords only work in
   * non-production and are compared in constant time.
   */
  password?: string;
  /** Preferred: scrypt hash produced by `hashPassword()` in lib/auth/password.ts */
  passwordHash?: string;
  name: string;
  roleCode: "OVERALL_ADMIN" | "DEPT_ADMIN" | "DEPT_STAFF" | "PUBLIC";
  roleName?: string;
  departmentCode?: string; // ELEC, CIVIL, PLUMB, HVAC, COOLER, CARP, IT
  departmentName?: string;
  phone?: string;
}

/**
 * AUTHORIZED USERS SCHEMA / CONFIGURATION
 * -------------------------------------------------------------
 * Add, edit, or remove users who can log in to the IITGN Maintenance Portal.
 * You can specify their email, allowed password, role, and department.
 */
export const ALLOWED_USERS: AllowedUserConfig[] = [
  // --- Demo Regular Users (Students, Faculty & Campus Residents) ---
  {
    email: "demo1@iitgn.ac.in",
    password: "asd@123",
    name: "Demo User 1 (Student)",
    roleCode: "PUBLIC",
    roleName: "Student / Resident",
    departmentName: "Hostel Resident (Aibaan Block)",
    phone: "+91-98765-10001",
  },
  {
    email: "demo2@iitgn.ac.in",
    password: "asd@123",
    name: "Demo User 2 (Faculty)",
    roleCode: "PUBLIC",
    roleName: "Faculty / Resident",
    departmentName: "Staff Housing (Apartment 14/203)",
    phone: "+91-98765-10002",
  },
  {
    email: "demo3@iitgn.ac.in",
    password: "asd@123",
    name: "Demo User 3 (Campus Member)",
    roleCode: "PUBLIC",
    roleName: "Regular User",
    departmentName: "Campus Resident",
    phone: "+91-98765-10003",
  },

  // --- Official Institute Works Leadership & Staff (Admin Accounts) ---
  {
    email: "admin@iitgn.ac.in",
    password: "asd@123",
    name: "Er. A. K. Jain (Superintending Engineer)",
    roleCode: "OVERALL_ADMIN",
    roleName: "Overall Admin",
    departmentName: "Institute Works Department (Super Admin)",
    phone: "+91-79-2395-2005",
  },
  {
    email: "aee.electrical@iitgn.ac.in",
    password: "asd@123",
    name: "Er. Alok Verma (AEE Electrical)",
    roleCode: "DEPT_ADMIN",
    roleName: "Department Admin",
    departmentCode: "ELEC",
    departmentName: "Electrical Maintenance",
    phone: "+91-79-2395-2010",
  },
  {
    email: "aee.civil@iitgn.ac.in",
    password: "asd@123",
    name: "Er. Priya Patel (AEE Civil)",
    roleCode: "DEPT_ADMIN",
    roleName: "Department Admin",
    departmentCode: "CIVIL",
    departmentName: "Civil & Masonry",
    phone: "+91-79-2395-2020",
  },
  {
    email: "tech.rajesh@iitgn.ac.in",
    password: "asd@123",
    name: "Rajesh Kumar (Sr. Electrician)",
    roleCode: "DEPT_STAFF",
    roleName: "Department Staff",
    departmentCode: "ELEC",
    departmentName: "Electrical Maintenance",
    phone: "+91-98765-43210",
  },
  {
    email: "tech.suresh@iitgn.ac.in",
    password: "asd@123",
    name: "Suresh Patel (Lead Plumber)",
    roleCode: "DEPT_STAFF",
    roleName: "Department Staff",
    departmentCode: "PLUMB",
    departmentName: "Plumbing & Sanitary",
    phone: "+91-98765-43211",
  },
];
