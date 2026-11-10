/**
 * Client-safe account directory.
 *
 * IMPORTANT: This file is imported by client components and therefore ships in
 * the browser bundle. It must NEVER contain passwords, hashes, or other secrets.
 * Secrets live in `src/config/users.ts`, which is server-only.
 */

export interface PublicAccount {
  email: string;
  name: string;
  roleCode: "OVERALL_ADMIN" | "DEPT_ADMIN" | "DEPT_STAFF" | "PUBLIC";
  roleName?: string;
  departmentCode?: string;
  departmentName?: string;
}

export const PUBLIC_ACCOUNTS: PublicAccount[] = [
  {
    email: "demo1@iitgn.ac.in",
    name: "Demo User 1 (Student)",
    roleCode: "PUBLIC",
    roleName: "Student / Resident",
    departmentName: "Hostel Resident (Aibaan Block)",
  },
  {
    email: "demo2@iitgn.ac.in",
    name: "Demo User 2 (Faculty)",
    roleCode: "PUBLIC",
    roleName: "Faculty / Resident",
    departmentName: "Staff Housing (Apartment 14/203)",
  },
  {
    email: "demo3@iitgn.ac.in",
    name: "Demo User 3 (Campus Member)",
    roleCode: "PUBLIC",
    roleName: "Regular User",
    departmentName: "Campus Resident",
  },
  {
    email: "admin@iitgn.ac.in",
    name: "Er. A. K. Jain (Superintending Engineer)",
    roleCode: "OVERALL_ADMIN",
    roleName: "Overall Admin",
    departmentName: "Institute Works Department (Super Admin)",
  },
  {
    email: "aee.electrical@iitgn.ac.in",
    name: "Er. Alok Verma (AEE Electrical)",
    roleCode: "DEPT_ADMIN",
    roleName: "Department Admin",
    departmentCode: "ELEC",
    departmentName: "Electrical Maintenance",
  },
  {
    email: "aee.civil@iitgn.ac.in",
    name: "Er. Priya Patel (AEE Civil)",
    roleCode: "DEPT_ADMIN",
    roleName: "Department Admin",
    departmentCode: "CIVIL",
    departmentName: "Civil & Masonry",
  },
  {
    email: "tech.rajesh@iitgn.ac.in",
    name: "Rajesh Kumar (Sr. Electrician)",
    roleCode: "DEPT_STAFF",
    roleName: "Department Staff",
    departmentCode: "ELEC",
    departmentName: "Electrical Maintenance",
  },
  {
    email: "tech.suresh@iitgn.ac.in",
    name: "Suresh Patel (Lead Plumber)",
    roleCode: "DEPT_STAFF",
    roleName: "Department Staff",
    departmentCode: "PLUMB",
    departmentName: "Plumbing & Sanitary",
  },
];