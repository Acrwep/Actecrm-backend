const pool = require("../config/dbconfig");

const BulkSearchModel = {
  bulkSearch: async (users_data) => {
    try {
      // Process all rows in parallel for better performance
      const searchPromises = users_data.map(async (item) => {
        const [results] = await pool.query(
          `SELECT l.id AS lead_id, c.id AS customer_id, l.name, l.phone, l.email, lt.name AS lead_type, 
                u.user_id, u.user_name, l.created_date 
         FROM lead_master AS l 
         LEFT JOIN customers AS c ON c.lead_id = l.id 
         LEFT JOIN users AS u ON u.user_id = l.assigned_to 
         LEFT JOIN lead_type AS lt ON l.lead_type_id = lt.id 
         WHERE l.phone = ? OR c.phone = ? OR l.email = ? OR c.email = ?`,
          [item.mobile, item.mobile, item.email, item.email]
        );

        let status = "Not found";
        let result = null;

        if (results.length > 0) {
          result = results[0];
          // Simplified status logic
          if (result.customer_id) {
            status = "Success"; // Customer exists
          } else if (result.lead_id && result.customer_id === null) {
            status = "On Progress"; // Lead exists but not yet customer
          }
        }

        return {
          name: result?.name || "",
          email: item.email,
          mobile: item.mobile,
          status: status,
          lead_type: result?.lead_type || "",
          lead_by_id: result?.user_id || "",
          lead_by: result?.user_name || "",
          created_on: result?.created_date || "",
        };
      });

      // Wait for all searches to complete
      const data = await Promise.all(searchPromises);

      return data;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = BulkSearchModel;
