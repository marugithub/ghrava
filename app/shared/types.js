// @ts-check
'use strict';
/**
 * shared/types.js
 * JSDoc typedefs for all major database row shapes.
 * Imported (require) anywhere type annotations are needed.
 * No runtime code — types only.
 */

/**
 * @typedef {Object} FamilyMember
 * @property {number} id
 * @property {string} display_name
 * @property {string|null} full_legal_name
 * @property {string|null} relationship
 * @property {string|null} date_of_birth
 * @property {string|null} ssn_last4
 * @property {number} is_primary_user
 * @property {string|null} notes
 */

/**
 * @typedef {Object} Tag
 * @property {number} id
 * @property {string} name
 * @property {string} color_hex
 * @property {number} usage_count
 */

/**
 * @typedef {Object} DropdownOption
 * @property {number} id
 * @property {string} list_key
 * @property {string} label
 * @property {string} value
 * @property {number} is_active
 * @property {number} sort_order
 */

/**
 * @typedef {Object} HsaPayment
 * @property {number} id
 * @property {string} date
 * @property {string|null} patient
 * @property {string|null} provider
 * @property {number|null} you_paid
 * @property {number} hsa_eligible
 * @property {number} reimbursed
 * @property {number|null} receipt_saved
 */

/**
 * @typedef {Object} HsaOtc
 * @property {number} id
 * @property {string} date
 * @property {number|null} amount
 * @property {number} hsa_eligible
 * @property {number} reimbursed
 */

/**
 * @typedef {Object} InventoryItem
 * @property {number} id
 * @property {string} item_ref
 * @property {string} name
 * @property {string|null} category
 * @property {string|null} expiration_date
 * @property {string|null} warranty_expires
 * @property {number|null} purchase_price
 * @property {number} lifetime_warranty
 * @property {number} is_active
 * @property {number} is_archived
 */

/**
 * @typedef {Object} InventoryItemHw
 * @property {number} id
 * @property {number} item_id
 * @property {string|null} expiration_date
 */

/**
 * @typedef {Object} DailyLogEntry
 * @property {number} id
 * @property {string} log_date
 * @property {string|null} entry_text
 * @property {number} follow_up_needed
 * @property {string|null} follow_up_date
 */

/**
 * @typedef {Object} Medication
 * @property {number} id
 * @property {string} name
 * @property {string|null} patient
 * @property {string|null} status
 * @property {string|null} end_date
 */

/**
 * @typedef {Object} VehicleService
 * @property {number} id
 * @property {string|null} service_type
 * @property {string|null} next_due_date
 * @property {string|null} nickname
 * @property {string|null} make
 * @property {string|null} model
 */

/**
 * @typedef {Object} PropertyMaintenance
 * @property {number} id
 * @property {string|null} category
 * @property {string|null} description
 * @property {string|null} next_due_date
 * @property {string|null} nickname
 */

/**
 * @typedef {Object} Todo
 * @property {number} id
 * @property {string} title
 * @property {string|null} notes
 * @property {string|null} due_date
 * @property {string} status
 * @property {string|null} priority
 * @property {string|null} category
 * @property {number} is_auto
 * @property {string|null} auto_type
 * @property {string|null} auto_source_type
 * @property {number|null} auto_source_id
 * @property {string|null} recurrence
 * @property {number|null} recurrence_days
 * @property {string|null} reminder_date
 * @property {string|null} completed_at
 * @property {string|null} google_task_id
 */

/**
 * @typedef {Object} Attachment
 * @property {number} id
 * @property {string} module
 * @property {number} entity_id
 * @property {string|null} original_filename
 * @property {string|null} stored_path
 * @property {string|null} thumb_path
 * @property {string|null} unc_path
 * @property {string|null} mime_type
 * @property {string|null} attachment_type
 */

/**
 * @typedef {Object} Contact
 * @property {number} id
 * @property {string} contact_type
 * @property {string} name
 * @property {string|null} specialty
 * @property {string|null} company
 * @property {string|null} phone_primary
 * @property {string|null} email
 */

/**
 * @typedef {Object} CareerCertification
 * @property {number} id
 * @property {string} name
 * @property {string|null} issuing_body
 * @property {string|null} credential_id
 * @property {string|null} cert_number
 * @property {string|null} issue_date
 * @property {string|null} expiry_date
 * @property {string} status
 * @property {number|null} ce_hours_required
 * @property {number|null} renewal_period_months
 * @property {string|null} current_cycle_start
 * @property {string|null} current_cycle_end
 * @property {string|null} notes
 */

/**
 * @typedef {Object} CareerLearning
 * @property {number} id
 * @property {string} title
 * @property {string} learning_type
 * @property {string|null} provider
 * @property {string|null} start_date
 * @property {string|null} end_date
 * @property {number|null} hours_total
 * @property {string|null} location
 * @property {string|null} url
 * @property {number|null} cost
 * @property {string|null} description
 * @property {string|null} notes
 * @property {number|null} instructor_contact_id
 */

/**
 * @typedef {Object} ApiError
 * @property {string} error
 * @property {number} [status]
 */

module.exports = {};
