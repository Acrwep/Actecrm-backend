const pool = require("../config/dbconfig");

const DashboardModel = {
  getScoreBoard: async (user_ids, start_date, end_date) => {
    try {
      let leadQuery = `SELECT COUNT(id) AS total_leads FROM lead_master WHERE 1 = 1`;
      let joinQuery = `SELECT COUNT(c.id) AS join_count FROM customers AS c INNER JOIN lead_master AS l ON c.lead_id = l.id WHERE 1 = 1`;
      let followupQuery = `SELECT SUM(CASE WHEN lf.is_updated = 1 THEN 1 ELSE 0 END) AS follow_up_handled, SUM(CASE WHEN lf.is_updated = 0 THEN 1 ELSE 0 END) AS follow_up_unhandled FROM lead_follow_up_history AS lf INNER JOIN lead_master AS l ON l.id = lf.lead_id WHERE 1 = 1`;
      let saleVolumeQuery = `SELECT IFNULL(SUM(pm.total_amount), 0) AS sale_volume FROM customers AS c INNER JOIN payment_master AS pm ON c.lead_id = pm.lead_id INNER JOIN lead_master AS l ON l.id = c.lead_id WHERE 1 = 1`;
      let collectionQuery = `SELECT IFNULL(SUM(pt.amount), 0) AS collection FROM customers AS c INNER JOIN payment_master AS pm ON c.lead_id = pm.lead_id INNER JOIN lead_master AS l ON l.id = c.lead_id INNER JOIN payment_trans AS pt ON pt.payment_master_id = pm.id WHERE pt.payment_status <> 'Rejected'`;
      let pendingCollectionQuery = `WITH CTE AS (SELECT pm.id FROM customers AS c INNER JOIN payment_master AS pm ON c.lead_id = pm.lead_id INNER JOIN lead_master AS l ON l.id = c.lead_id WHERE 1 = 1`;

      let totalCollectionQuery = `SELECT IFNULL(SUM(pt.amount), 0) AS total_collection FROM lead_master AS l INNER JOIN customers AS c ON c.lead_id = l.id INNER JOIN payment_master AS pm ON pm.lead_id = c.lead_id INNER JOIN payment_trans AS pt ON pt.payment_master_id = pm.id WHERE 1 = 1`;
      const leadParams = [];
      const joinParams = [];
      const followupParams = [];
      const saleVolumeParams = [];
      const collectionParams = [];
      const pendingCollectionParams = [];
      const totalCollectionParams = [];
      // Handle user_ids parameter for both queries
      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          leadQuery += ` AND assigned_to IN (${placeholders})`;
          joinQuery += ` AND l.assigned_to IN (${placeholders})`;
          followupQuery += ` AND l.assigned_to IN (${placeholders})`;
          saleVolumeQuery += ` AND l.assigned_to IN (${placeholders})`;
          collectionQuery += ` AND l.assigned_to IN (${placeholders})`;
          pendingCollectionQuery += ` AND l.assigned_to IN (${placeholders})`;
          totalCollectionQuery += ` AND l.assigned_to IN (${placeholders})`;
          leadParams.push(...user_ids);
          joinParams.push(...user_ids);
          followupParams.push(...user_ids);
          saleVolumeParams.push(...user_ids);
          collectionParams.push(...user_ids);
          pendingCollectionParams.push(...user_ids);
          totalCollectionParams.push(...user_ids);
        } else if (!Array.isArray(user_ids)) {
          leadQuery += ` AND assigned_to = ?`;
          joinQuery += ` AND l.assigned_to = ?`;
          followupQuery += ` AND l.assigned_to = ?`;
          saleVolumeQuery += ` AND l.assigned_to = ?`;
          collectionQuery += ` AND l.assigned_to = ?`;
          pendingCollectionQuery += ` AND l.assigned_to = ?`;
          totalCollectionQuery += ` AND l.assigned_to = ?`;
          leadParams.push(user_ids);
          joinParams.push(user_ids);
          followupParams.push(user_ids);
          saleVolumeParams.push(user_ids);
          collectionParams.push(user_ids);
          pendingCollectionParams.push(user_ids);
          totalCollectionParams.push(user_ids);
        }
      }

      if (start_date && end_date) {
        leadQuery += ` AND CAST(created_date AS DATE) BETWEEN ? AND ?`;
        joinQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        followupQuery += ` AND CAST(lf.next_follow_up_date AS DATE) BETWEEN ? AND ?`;
        saleVolumeQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        collectionQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        pendingCollectionQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        totalCollectionQuery += ` AND CAST(pt.invoice_date AS DATE) BETWEEN ? AND ?`;
        leadParams.push(start_date, end_date);
        joinParams.push(start_date, end_date);
        followupParams.push(start_date, end_date);
        saleVolumeParams.push(start_date, end_date);
        collectionParams.push(start_date, end_date);
        pendingCollectionParams.push(start_date, end_date);
        totalCollectionParams.push(start_date, end_date);
      }

      pendingCollectionQuery += `) SELECT IFNULL(SUM(pt.amount), 0) AS pending_collection FROM lead_master AS l INNER JOIN customers AS c ON c.lead_id = l.id INNER JOIN payment_master AS pm ON pm.lead_id = c.lead_id INNER JOIN payment_trans AS pt ON pm.id = pt.payment_master_id WHERE pt.payment_master_id NOT IN (SELECT id FROM CTE)`;

      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          pendingCollectionQuery += ` AND l.assigned_to IN (${placeholders})`;
          pendingCollectionParams.push(...user_ids);
        } else {
          pendingCollectionQuery += ` AND l.assigned_to = ?`;
          pendingCollectionParams.push(user_ids);
        }
      }

      if (start_date && end_date) {
        pendingCollectionQuery += ` AND CAST(pt.invoice_date AS DATE) BETWEEN ? AND ?`;
        pendingCollectionParams.push(start_date, end_date);
      }

      const [getTotalLeads] = await pool.query(leadQuery, leadParams);
      const [getTotalJoins] = await pool.query(joinQuery, joinParams);
      const [getFollowupCount] = await pool.query(
        followupQuery,
        followupParams
      );
      const [getSaleVolume] = await pool.query(
        saleVolumeQuery,
        saleVolumeParams
      );
      const [getCollection] = await pool.query(
        collectionQuery,
        collectionParams
      );

      const [getPendingCollection] = await pool.query(
        pendingCollectionQuery,
        pendingCollectionParams
      );

      const [getTotalCollection] = await pool.query(
        totalCollectionQuery,
        totalCollectionParams
      );

      return {
        total_leads: getTotalLeads[0].total_leads,
        total_join: getTotalJoins[0].join_count,
        follow_up_handled: getFollowupCount[0].follow_up_handled || 0,
        follow_up_unhandled: getFollowupCount[0].follow_up_unhandled || 0,
        sale_volume: parseFloat(getSaleVolume[0].sale_volume).toFixed(2),
        // collection: parseFloat(getCollection[0].collection).toFixed(2),
        // pending_collection: parseFloat(
        //   getPendingCollection[0].pending_collection
        // ).toFixed(2),
        total_collection: parseFloat(
          getTotalCollection[0].total_collection
        ).toFixed(2),
        pending_payment: (
          parseFloat(getSaleVolume[0].sale_volume) -
          parseFloat(getCollection[0].collection)
        ).toFixed(2),
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getHRDashboard: async (user_ids, start_date, end_date) => {
    try {
      const queryParams = [];
      let sql = `SELECT SUM(CASE WHEN c.status = 'Awaiting Trainer' THEN 1 ELSE 0 END) AS awaiting_trainer, SUM(CASE WHEN c.status = 'Awaiting Trainer Verify' THEN 1 ELSE 0 END) AS awaiting_trainer_verify, SUM(CASE WHEN c.status = 'Trainer Rejected' THEN 1 ELSE 0 END) AS rejected_trainer, SUM(CASE WHEN c.status = 'Awaiting Class' THEN 1 ELSE 0 END) AS verified_trainer FROM customers AS c INNER JOIN lead_master AS l ON c.lead_id = l.id WHERE 1 = 1`;

      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          sql += ` AND l.assigned_to IN (${placeholders})`;
          queryParams.push(...user_ids);
        } else {
          sql += ` AND l.assigned_to = ?`;
          queryParams.push(user_ids);
        }
      }

      if (start_date && end_date) {
        sql += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        queryParams.push(start_date, end_date);
      }

      const [result] = await pool.query(sql, queryParams);
      return result[0];
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getRADashboard: async (user_ids, start_date, end_date) => {
    try {
      const queryParams = [];
      let sql = `SELECT SUM(CASE WHEN c.status = 'Awaiting Verify' THEN 1 ELSE 0 END) AS awaiting_verify, SUM(CASE WHEN c.status = 'Awaiting Class' THEN 1 ELSE 0 END) AS awaiting_class, SUM(CASE WHEN c.status = 'Class Scheduled' THEN 1 ELSE 0 END) AS class_scheduled, SUM(CASE WHEN c.status = 'Escalated' THEN 1 ELSE 0 END) AS escalated, SUM(CASE WHEN c.status = 'Class Going' THEN 1 ELSE 0 END) AS class_going, SUM(CASE WHEN c.google_review IS NOT NULL THEN 1 ELSE 0 END) AS google_review_count, SUM(CASE WHEN c.linkedin_review IS NOT NULL THEN 1 ELSE 0 END) AS linkedin_review_count FROM customers AS c INNER JOIN lead_master AS l ON c.lead_id = l.id WHERE 1 = 1`;

      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          sql += ` AND l.assigned_to IN (${placeholders})`;
          queryParams.push(...user_ids);
        } else {
          sql += ` AND l.assigned_to = ?`;
          queryParams.push(user_ids);
        }
      }

      if (start_date && end_date) {
        sql += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        queryParams.push(start_date, end_date);
      }

      const [result] = await pool.query(sql, queryParams);
      return result[0];
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getTopPerforming: async (user_ids, start_date, end_date) => {
    try {
      const queryParams = [];
      const totalLeadParams = [];
      let getQuery = `SELECT lt.name, COUNT(l.id) AS lead_count, SUM(CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END) AS converted_to_customer FROM lead_type AS lt LEFT JOIN lead_master AS l ON lt.id = l.lead_type_id`;

      let totalLeadQuery = `SELECT COUNT(l.id) AS total_lead_count FROM lead_master AS l WHERE 1 = 1`;

      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          getQuery += ` AND l.assigned_to IN (${placeholders})`;
          totalLeadQuery += ` AND l.assigned_to IN (${placeholders})`;
          queryParams.push(...user_ids);
          totalLeadParams.push(...user_ids);
        } else {
          getQuery += ` AND l.assigned_to = ?`;
          totalLeadQuery += ` AND l.assigned_to = ?`;
          queryParams.push(user_ids);
          totalLeadParams.push(user_ids);
        }
      }

      if (start_date && end_date) {
        getQuery += ` AND CAST(l.created_date AS DATE) BETWEEN ? AND ?`;
        totalLeadQuery += ` AND CAST(l.created_date AS DATE) BETWEEN ? AND ?`;
        queryParams.push(start_date, end_date);
        totalLeadParams.push(start_date, end_date);
      }

      getQuery += ` LEFT JOIN customers AS c ON c.lead_id = l.id GROUP BY lt.name`;

      const [result] = await pool.query(getQuery, queryParams);

      const [getTotalLead] = await pool.query(totalLeadQuery, totalLeadParams);

      const formattedResult = result.map((item) => {
        const lead_percentage = parseFloat(
          (item.lead_count / getTotalLead[0].total_lead_count) * 100
        ).toFixed(2);
        return {
          ...item,
          lead_percentage: isNaN(lead_percentage) ? 0 : lead_percentage,
        };
      });

      return formattedResult;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getUserWiseScoreBoard: async (user_ids, start_date, end_date, type) => {
    try {
      let saleVolumeQuery = `
      SELECT 
        u.user_id, 
        u.user_name, 
        IFNULL(SUM(pm.total_amount), 0) AS sale_volume
      FROM users AS u
      LEFT JOIN lead_master AS l ON l.assigned_to = u.user_id
      LEFT JOIN customers AS c ON c.lead_id = l.id`;

      let collectionQuery = `
      SELECT 
        u.user_id, 
        u.user_name, 
        IFNULL(SUM(pt.amount), 0) AS collection
      FROM users AS u
      LEFT JOIN lead_master AS l ON l.assigned_to = u.user_id
      LEFT JOIN customers AS c ON c.lead_id = l.id`;

      let totalCollectionQuery = `
      SELECT 
        u.user_id, 
        u.user_name, 
        IFNULL(SUM(pt.amount), 0) AS total_collection
      FROM users AS u
      LEFT JOIN lead_master AS l ON l.assigned_to = u.user_id
      LEFT JOIN customers AS c ON c.lead_id = l.id
      LEFT JOIN payment_master AS pm ON pm.lead_id = c.lead_id
      LEFT JOIN payment_trans AS pt ON pt.payment_master_id = pm.id
    `;

      const params = {
        sale: [],
        collection: [],
        total: [],
      };

      // 🔹 Filter by date range
      if (start_date && end_date) {
        saleVolumeQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        collectionQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        totalCollectionQuery += ` AND CAST(pt.invoice_date AS DATE) BETWEEN ? AND ?`;
        params.sale.push(start_date, end_date);
        params.collection.push(start_date, end_date);
        params.total.push(start_date, end_date);
      }

      saleVolumeQuery += ` LEFT JOIN payment_master AS pm ON pm.lead_id = c.lead_id WHERE 1 = 1`;
      collectionQuery += ` LEFT JOIN payment_master AS pm ON pm.lead_id = c.lead_id
      LEFT JOIN payment_trans AS pt ON pt.payment_master_id = pm.id AND pt.payment_status <> 'Rejected' WHERE 1 = 1`;
      totalCollectionQuery += ` WHERE 1 = 1`;

      // 🔹 Filter by user(s)
      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          saleVolumeQuery += ` AND u.user_id IN (${placeholders})`;
          collectionQuery += ` AND u.user_id IN (${placeholders})`;
          totalCollectionQuery += ` AND u.user_id IN (${placeholders})`;
          params.sale.push(...user_ids);
          params.collection.push(...user_ids);
          params.total.push(...user_ids);
        } else {
          saleVolumeQuery += ` AND u.user_id = ?`;
          collectionQuery += ` AND u.user_id = ?`;
          totalCollectionQuery += ` AND u.user_id = ?`;
          params.sale.push(user_ids);
          params.collection.push(user_ids);
          params.total.push(user_ids);
        }
      }

      saleVolumeQuery += ` GROUP BY u.user_id, u.user_name ORDER BY sale_volume DESC`;
      collectionQuery += ` GROUP BY u.user_id, u.user_name ORDER BY collection DESC`;
      totalCollectionQuery += ` GROUP BY u.user_id, u.user_name ORDER BY total_collection DESC`;

      // 🔹 Execute queries
      const [saleData] = await pool.query(saleVolumeQuery, params.sale);

      const [collectionData] = await pool.query(
        collectionQuery,
        params.collection
      );
      const [totalCollectionData] = await pool.query(
        totalCollectionQuery,
        params.total
      );

      // 🔹 Map data user-wise
      const result = saleData.map((saleUser) => {
        const collectionUser = collectionData.find(
          (c) => c.user_id === saleUser.user_id
        ) || { collection: 0 };
        const totalUser = totalCollectionData.find(
          (t) => t.user_id === saleUser.user_id
        ) || { total_collection: 0 };

        const pending = saleUser.sale_volume - collectionUser.collection;

        return {
          user_id: saleUser.user_id,
          user_name: saleUser.user_name,
          sale_volume: saleUser.sale_volume,
          total_collection: totalUser.total_collection,
          pending: pending < 0 ? 0 : pending,
        };
      });

      // 🔹 If specific type requested
      if (type === "Sale")
        return result.map((r) => ({
          user_id: r.user_id,
          user_name: r.user_name,
          sale_volume: parseFloat(r.sale_volume).toFixed(2),
        }));
      if (type === "Collection") {
        const formattedResult = await Promise.all(
          result.map(async (r) => {
            const [getTarget] = await pool.query(
              `SELECT id AS user_target_id, target_month, target_value FROM user_target_master WHERE user_id = ? AND target_month = CONCAT(DATE_FORMAT(?, '%b %Y'), ' - ', DATE_FORMAT(?, '%b %Y')) ORDER BY id DESC LIMIT 1`,
              [r.user_id, start_date, end_date]
            );

            const target_month = getTarget[0]?.target_month || "";
            const target_value = getTarget[0]?.target_value || 0;
            // Prevent division by zero
            const percentage =
              target_value > 0
                ? ((r.total_collection / target_value) * 100).toFixed(2)
                : 0;

            return {
              user_id: r.user_id,
              user_name: r.user_name,
              total_collection: parseFloat(r.total_collection).toFixed(2),
              target_month: target_month,
              target_value: target_value,
              percentage: isNaN(percentage) ? 0 : percentage,
            };
          })
        );

        return formattedResult;
      }
      if (type === "Pending")
        return result.map((r) => ({
          user_id: r.user_id,
          user_name: r.user_name,
          pending: parseFloat(r.pending).toFixed(2),
        }));

      // 🔹 Default: full scoreboard
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = DashboardModel;
