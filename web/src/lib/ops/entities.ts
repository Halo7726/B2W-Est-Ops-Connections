export type FieldType = "string" | "number" | "boolean" | "date";

export interface EntityField {
  name: string;
  label: string;
  type: FieldType;
}

export interface EntityInfo {
  label: string;
  fields: EntityField[];
}

export const ENTITY_REGISTRY: Record<string, EntityInfo> = {
  Job: {
    label: "Job",
    fields: [
      { name: "ObjectID", label: "Object ID", type: "string" },
      { name: "JobNumber", label: "Job Number", type: "string" },
      { name: "Title", label: "Title", type: "string" },
      { name: "ProjectName", label: "Project Name", type: "string" },
      { name: "IsActive", label: "Is Active", type: "boolean" },
      { name: "JobStatus", label: "Job Status", type: "string" },
      { name: "BusinessUnitUniqueName", label: "Business Unit", type: "string" },
      { name: "CustomerID", label: "Customer ID", type: "string" },
      { name: "RequireTrackWorkOrderOnFL", label: "Require Track Work Order", type: "boolean" },
      { name: "Notes", label: "Notes", type: "string" },
    ],
  },

  Equipment: {
    label: "Equipment",
    fields: [
      { name: "ObjectID", label: "Object ID", type: "string" },
      { name: "EquipmentID", label: "Equipment ID", type: "string" },
      { name: "Description", label: "Description", type: "string" },
      { name: "IsInactive", label: "Is Inactive", type: "boolean" },
      { name: "Category", label: "Category", type: "string" },
      { name: "Subcategory", label: "Subcategory", type: "string" },
      { name: "BusinessUnitUniqueName", label: "Business Unit", type: "string" },
      { name: "SerialNumber", label: "Serial Number", type: "string" },
      { name: "Year", label: "Year", type: "number" },
      { name: "Make", label: "Make", type: "string" },
      { name: "Model", label: "Model", type: "string" },
      { name: "OwnershipType", label: "Ownership Type", type: "string" },
      { name: "Notes", label: "Notes", type: "string" },
    ],
  },

  Employee: {
    label: "Employee",
    fields: [
      { name: "ObjectID", label: "Object ID", type: "string" },
      { name: "EmployeeID", label: "Employee ID", type: "string" },
      { name: "FirstName", label: "First Name", type: "string" },
      { name: "LastName", label: "Last Name", type: "string" },
      { name: "IsInactive", label: "Is Inactive", type: "boolean" },
      { name: "BusinessUnitUniqueName", label: "Business Unit", type: "string" },
      { name: "Title", label: "Title", type: "string" },
      { name: "Category", label: "Category", type: "string" },
      { name: "Notes", label: "Notes", type: "string" },
    ],
  },

  JobSite: {
    label: "Job Site",
    fields: [
      { name: "ObjectID", label: "Object ID", type: "string" },
      { name: "JobNumber", label: "Job Number", type: "string" },
      { name: "Description", label: "Description", type: "string" },
      { name: "IsInactive", label: "Is Inactive", type: "boolean" },
      { name: "SiteSupervisorEmployeeID", label: "Site Supervisor", type: "string" },
      { name: "Category", label: "Category", type: "string" },
      { name: "Start", label: "Start Date", type: "date" },
      { name: "End", label: "End Date", type: "date" },
      { name: "City", label: "City", type: "string" },
      { name: "StateProvince", label: "State/Province", type: "string" },
      { name: "Notes", label: "Notes", type: "string" },
    ],
  },

  JobProductionTarget: {
    label: "Job Production Target",
    fields: [
      { name: "ObjectID", label: "Object ID", type: "string" },
      { name: "JobNumber", label: "Job Number", type: "string" },
      { name: "JobSiteDescription", label: "Job Site Description", type: "string" },
      { name: "TargetDate", label: "Target Date", type: "date" },
      { name: "TrackingID", label: "Tracking ID", type: "string" },
      { name: "CrewID", label: "Crew ID", type: "string" },
      { name: "CrewForemanEmployeeID", label: "Crew Foreman Employee ID", type: "string" },
      { name: "CrewWorkType", label: "Crew Work Type", type: "string" },
      { name: "CrewSize", label: "Crew Size", type: "number" },
      { name: "Duration", label: "Duration (hrs)", type: "number" },
      { name: "ProductionMethod", label: "Production Method", type: "string" },
      { name: "TargetMethod", label: "Target Method", type: "string" },
      { name: "TargetQuantity", label: "Target Quantity", type: "number" },
      { name: "ProductionRate", label: "Production Rate", type: "number" },
      { name: "Notes", label: "Notes", type: "string" },
    ],
  },

  JobProductionAccount: {
    label: "Job Production Account",
    fields: [
      { name: "ObjectID", label: "Object ID", type: "string" },
      { name: "JobNumber", label: "Job Number", type: "string" },
      { name: "TrackingID", label: "Tracking ID", type: "string" },
      { name: "UnitOfMeasure", label: "Unit of Measure", type: "string" },
      { name: "OriginalEstimatedQuantity", label: "Original Est. Quantity", type: "number" },
      { name: "ChangeOrderQuantity", label: "Change Order Quantity", type: "number" },
      { name: "ProjectedTotalQuantity", label: "Projected Total Quantity", type: "number" },
      { name: "Description", label: "Description", type: "string" },
    ],
  },

  JobEstimateItem: {
    label: "Job Estimate Item",
    fields: [
      { name: "ObjectID", label: "Object ID", type: "string" },
      { name: "JobNumber", label: "Job Number", type: "string" },
      { name: "TrackingID", label: "Tracking ID", type: "string" },
      { name: "Description", label: "Description", type: "string" },
      { name: "UnitOfMeasure", label: "Unit of Measure", type: "string" },
      { name: "Quantity", label: "Quantity", type: "number" },
      { name: "UnitCost", label: "Unit Cost", type: "number" },
      { name: "TotalCost", label: "Total Cost", type: "number" },
      { name: "IsHidden", label: "Is Hidden", type: "boolean" },
    ],
  },

  ResourceEvent: {
    label: "Resource Event",
    fields: [
      { name: "ObjectID", label: "Object ID", type: "string" },
      { name: "StartDate", label: "Start Date", type: "date" },
      { name: "EndDate", label: "End Date", type: "date" },
      { name: "Category", label: "Category", type: "string" },
      { name: "Description", label: "Description", type: "string" },
      { name: "JobNumber", label: "Job Number", type: "string" },
    ],
  },

  Material: {
    label: "Material",
    fields: [
      { name: "ObjectID", label: "Object ID", type: "string" },
      { name: "MaterialID", label: "Material ID", type: "string" },
      { name: "Description", label: "Description", type: "string" },
      { name: "IsInactive", label: "Is Inactive", type: "boolean" },
      { name: "BusinessUnitUniqueName", label: "Business Unit", type: "string" },
      { name: "Category", label: "Category", type: "string" },
      { name: "Subcategory", label: "Subcategory", type: "string" },
      { name: "UnitOfMeasure", label: "Unit of Measure", type: "string" },
      { name: "UnitCost", label: "Unit Cost", type: "number" },
      { name: "Notes", label: "Notes", type: "string" },
    ],
  },

  Organization: {
    label: "Organization",
    fields: [
      { name: "ObjectID", label: "Object ID", type: "string" },
      { name: "OrganizationID", label: "Organization ID", type: "string" },
      { name: "CompanyName", label: "Company Name", type: "string" },
      { name: "IsInactive", label: "Is Inactive", type: "boolean" },
      { name: "BusinessUnitUniqueName", label: "Business Unit", type: "string" },
      { name: "IsCustomer", label: "Is Customer", type: "boolean" },
      { name: "IsSubcontractor", label: "Is Subcontractor", type: "boolean" },
      { name: "IsVendor", label: "Is Vendor", type: "boolean" },
      { name: "IsTruckingSubcontractor", label: "Is Trucking Sub", type: "boolean" },
      { name: "City", label: "City", type: "string" },
      { name: "StateProvince", label: "State/Province", type: "string" },
    ],
  },

  BusinessUnit: {
    label: "Business Unit",
    fields: [
      { name: "ObjectID", label: "Object ID", type: "string" },
      { name: "UniqueName", label: "Unique Name", type: "string" },
      { name: "Name", label: "Name", type: "string" },
      { name: "BusinessUnitFullPathName", label: "Full Path Name", type: "string" },
      { name: "AlternateID", label: "Alternate ID", type: "string" },
      { name: "IsInactive", label: "Is Inactive", type: "boolean" },
    ],
  },

  LaborType: {
    label: "Labor Type",
    fields: [
      { name: "ObjectID", label: "Object ID", type: "string" },
      { name: "LaborTypeID", label: "Labor Type ID", type: "string" },
      { name: "Name", label: "Name", type: "string" },
      { name: "IsInactive", label: "Is Inactive", type: "boolean" },
      { name: "BusinessUnitUniqueName", label: "Business Unit", type: "string" },
      { name: "Notes", label: "Notes", type: "string" },
    ],
  },

  MaintenanceRequest: {
    label: "Maintenance Request",
    fields: [
      { name: "ObjectID", label: "Object ID", type: "string" },
      { name: "MaintenanceRequestID", label: "Request ID", type: "number" },
      { name: "Description", label: "Description", type: "string" },
      { name: "Status", label: "Status", type: "string" },
      { name: "ProblemCode", label: "Problem Code", type: "string" },
      { name: "RequestPriority", label: "Priority", type: "string" },
      { name: "RequestType", label: "Request Type", type: "string" },
      { name: "CreatedOn", label: "Created On", type: "date" },
      { name: "CompletedOn", label: "Completed On", type: "date" },
      { name: "Notes", label: "Notes", type: "string" },
    ],
  },
};

export const ENTITY_NAMES = Object.keys(ENTITY_REGISTRY);

export function getEntityFields(entityName: string): EntityField[] {
  return ENTITY_REGISTRY[entityName]?.fields ?? [];
}

export function getEntityLabel(entityName: string): string {
  return ENTITY_REGISTRY[entityName]?.label ?? entityName;
}
