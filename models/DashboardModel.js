const pool = require("../config/dbconfig");

const DashboardModel = {
  getScoreBoard: async (user_ids, start_date, end_date) => {
    try {
      let leadQuery = `SELECT COUNT(id) AS total_leads FROM lead_master WHERE 1 = 1`;
      let joinQuery = `SELECT COUNT(c.id) AS join_count FROM customers AS c INNER JOIN lead_master AS l ON c.lead_id = l.id WHERE 1 = 1`;
      let followupQuery = `SELECT COUNT(lf.id) AS total_followups, SUM(CASE WHEN lf.is_updated = 1 THEN 1 ELSE 0 END) AS follow_up_handled, SUM(CASE WHEN lf.is_updated = 0 THEN 1 ELSE 0 END) AS follow_up_unhandled, ROUND(((SUM(CASE WHEN lf.is_updated = 1 THEN 1 ELSE 0 END) / COUNT(lf.id)) * 100), 2) AS percentage FROM lead_follow_up_history AS lf INNER JOIN lead_master AS l ON l.id = lf.lead_id LEFT JOIN customers AS c ON c.lead_id = l.id WHERE c.id IS NULL`;

      let saleVolumeQuery = `SELECT IFNULL(SUM(pm.total_amount), 0) AS sale_volume FROM customers AS c INNER JOIN payment_master AS pm ON c.lead_id = pm.lead_id INNER JOIN lead_master AS l ON l.id = c.lead_id WHERE 1 = 1`;
      let collectionQuery = `SELECT IFNULL(SUM(pt.amount), 0) AS collection FROM customers AS c INNER JOIN payment_master AS pm ON c.lead_id = pm.lead_id INNER JOIN lead_master AS l ON l.id = c.lead_id INNER JOIN payment_trans AS pt ON pt.payment_master_id = pm.id WHERE pt.payment_status <> 'Rejected'`;
      let pendingCollectionQuery = `WITH CTE AS (SELECT pm.id FROM customers AS c INNER JOIN payment_master AS pm ON c.lead_id = pm.lead_id INNER JOIN lead_master AS l ON l.id = c.lead_id WHERE 1 = 1`;

      let totalCollectionQuery = `SELECT IFNULL(SUM(pt.amount), 0) AS total_collection FROM lead_master AS l INNER JOIN customers AS c ON c.lead_id = l.id INNER JOIN payment_master AS pm ON pm.lead_id = c.lead_id INNER JOIN payment_trans AS pt ON pt.payment_master_id = pm.id AND pt.payment_status <> 'Rejected' WHERE 1 = 1`;
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
        total_followups: getFollowupCount[0].total_followups || 0,
        follow_up_handled: getFollowupCount[0].follow_up_handled || 0,
        follow_up_unhandled: getFollowupCount[0].follow_up_unhandled || 0,
        follow_up_percentage: getFollowupCount[0].percentage || 0,
        sale_volume: parseFloat(getSaleVolume[0].sale_volume).toFixed(2),
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
      let sql = `SELECT SUM(CASE WHEN c.status = 'Awaiting Verify' THEN 1 ELSE 0 END) AS awaiting_verify, SUM(CASE WHEN c.status = 'Awaiting Class' THEN 1 ELSE 0 END) AS awaiting_class, SUM(CASE WHEN c.status = 'Class Scheduled' THEN 1 ELSE 0 END) AS class_scheduled, SUM(CASE WHEN c.status = 'Escalated' THEN 1 ELSE 0 END) AS escalated, SUM(CASE WHEN c.status = 'Class Going' THEN 1 ELSE 0 END) AS class_going, SUM(CASE WHEN c.google_review IS NOT NULL THEN 1 ELSE 0 END) AS google_review_count, SUM(CASE WHEN c.linkedin_review IS NOT NULL THEN 1 ELSE 0 END) AS linkedin_review_count, SUM(CASE WHEN c.status = 'Completed' THEN 1 ELSE 0 END) AS class_completed FROM customers AS c INNER JOIN lead_master AS l ON c.lead_id = l.id WHERE 1 = 1`;

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
      LEFT JOIN payment_trans AS pt ON pt.payment_master_id = pm.id AND pt.payment_status <> 'Rejected'`;

      const params = {
        sale: [],
        collection: [],
        total: [],
      };

      // Filter by date range
      if (start_date && end_date) {
        saleVolumeQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        collectionQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        totalCollectionQuery += ` AND CAST(pt.invoice_date AS DATE) BETWEEN ? AND ?`;
        params.sale.push(start_date, end_date);
        params.collection.push(start_date, end_date);
        params.total.push(start_date, end_date);
      }

      saleVolumeQuery += ` LEFT JOIN payment_master AS pm ON pm.lead_id = c.lead_id WHERE u.roles LIKE '%Sale%'`;
      collectionQuery += ` LEFT JOIN payment_master AS pm ON pm.lead_id = c.lead_id
      LEFT JOIN payment_trans AS pt ON pt.payment_master_id = pm.id AND pt.payment_status <> 'Rejected' WHERE u.roles LIKE '%Sale%'`;
      totalCollectionQuery += ` WHERE u.roles LIKE '%Sale%'`;

      // Filter by user(s)
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

      // Execute queries
      const [saleData] = await pool.query(saleVolumeQuery, params.sale);

      const [collectionData] = await pool.query(
        collectionQuery,
        params.collection
      );
      const [totalCollectionData] = await pool.query(
        totalCollectionQuery,
        params.total
      );

      // Map data user-wise
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

      // If specific type requested
      if (type === "Sale") {
        result.sort((a, b) => b.sale_volume - a.sale_volume);
        return result.map((r) => ({
          user_id: r.user_id,
          user_name: r.user_name,
          sale_volume: parseFloat(r.sale_volume).toFixed(2),
        }));
      }

      if (type === "Collection") {
        result.sort((a, b) => b.total_collection - a.total_collection);
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
      if (type === "Pending") {
        result.sort((a, b) => b.pending - a.pending);
        return result.map((r) => ({
          user_id: r.user_id,
          user_name: r.user_name,
          pending: parseFloat(r.pending).toFixed(2),
        }));
      }

      // Default: full scoreboard
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getUserWiseLeadCounts: async (user_ids, start_date, end_date, type) => {
    try {
      const queryParams = [];
      const followupParams = [];
      const joiningParams = [];

      let getQuery = `
      SELECT 
        u.user_id, 
        u.user_name, 
        COUNT(l.id) AS total_leads,
        SUM(CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END) AS customer_count,
        ROUND(
          (SUM(CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(l.id), 0)) * 100, 
          2
        ) AS percentage
      FROM users AS u
      LEFT JOIN lead_master AS l ON u.user_id = l.assigned_to`;

      let followupQuery = `SELECT u.user_id, u.user_name, COUNT(lfh.id) AS lead_followup_count, SUM(CASE WHEN lfh.is_updated = 1 THEN 1 ELSE 0 END) AS followup_handled, SUM(CASE WHEN lfh.is_updated = 0 THEN 1 ELSE 0 END) AS followup_unhandled, ROUND(((SUM(CASE WHEN lfh.is_updated = 1 THEN 1 ELSE 0 END) / COUNT(lfh.id)) * 100), 2) AS percentage FROM users AS u LEFT JOIN lead_master AS l ON u.user_id = l.assigned_to LEFT JOIN customers AS c ON c.lead_id = l.id LEFT JOIN lead_follow_up_history AS lfh ON lfh.lead_id = l.id`;

      let joiningQuery = `SELECT u.user_id, u.user_name, IFNULL(COUNT(DISTINCT c.id), 0) AS customer_count FROM users AS u LEFT JOIN lead_master AS l ON l.assigned_to = u.user_id LEFT JOIN customers AS c ON l.id = c.lead_id`;

      // Filter by date range
      if (start_date && end_date) {
        getQuery += ` AND CAST(l.created_date AS DATE) BETWEEN ? AND ?`;
        followupQuery += ` AND CAST(lfh.next_follow_up_date AS DATE) BETWEEN ? AND ?`;
        joiningQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        queryParams.push(start_date, end_date);
        followupParams.push(start_date, end_date);
        joiningParams.push(start_date, end_date);
      }

      getQuery += ` LEFT JOIN customers AS c ON c.lead_id = l.id WHERE u.roles LIKE '%Sale%'`;
      followupQuery += ` WHERE c.id IS NULL AND u.roles LIKE '%Sale%'`;
      joiningQuery += ` WHERE u.roles LIKE '%Sale%'`;

      // Filter by user(s)
      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          getQuery += ` AND u.user_id IN (${placeholders})`;
          followupQuery += ` AND u.user_id IN (${placeholders})`;
          joiningQuery += ` AND u.user_id IN (${placeholders})`;
          queryParams.push(...user_ids);
          followupParams.push(...user_ids);
          joiningParams.push(...user_ids);
        } else {
          getQuery += ` AND u.user_id = ?`;
          followupQuery += ` AND u.user_id = ?`;
          joiningQuery += ` AND u.user_id = ?`;
          queryParams.push(user_ids);
          followupParams.push(user_ids);
          joiningParams.push(user_ids);
        }
      }

      // ✅ Order and grouping
      getQuery += ` GROUP BY u.user_id, u.user_name ORDER BY total_leads DESC`;
      followupQuery += ` GROUP BY u.user_id, u.user_name ORDER BY followup_unhandled DESC`;
      joiningQuery += ` GROUP BY u.user_id, u.user_name ORDER BY customer_count DESC`;

      switch (type) {
        case "Leads": {
          const [result] = await pool.query(getQuery, queryParams);
          const formattedResult = result.map((item) => ({
            ...item,
            percentage: item.percentage || 0.0,
          }));
          formattedResult.sort((a, b) => b.total_leads - a.total_leads);
          return formattedResult;
        }
        case "Follow Up": {
          const [followupResult] = await pool.query(
            followupQuery,
            followupParams
          );
          const formattedResult = followupResult.map((item) => ({
            ...item,
            percentage: item.percentage || 0.0,
          }));
          formattedResult.sort(
            (a, b) => b.followup_unhandled - a.followup_unhandled
          );
          return formattedResult;
        }
        case "Customer Join": {
          const [result] = await pool.query(joiningQuery, joiningParams);
          return result;
        }
        default:
          return [];
      }
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getBranchWiseScoreBoard: async (region_id, start_date, end_date, type) => {
    try {
      let saleVolumeQuery = `SELECT b.id AS branch_id, b.name AS branch_name, IFNULL(SUM(pm.total_amount), 0) AS sale_volume FROM branches AS b LEFT JOIN customers AS c ON b.id = c.branch_id`;

      let collectionQuery = `SELECT b.id AS branch_id, b.name AS branch_name, IFNULL(SUM(pt.amount), 0) AS collection FROM branches AS b LEFT JOIN customers AS c ON b.id = c.branch_id`;

      let totalCollectionQuery = `SELECT b.id AS branch_id, b.name AS branch_name, IFNULL(SUM(pt.amount), 0) AS total_collection FROM branches AS b LEFT JOIN customers AS c ON b.id = c.branch_id LEFT JOIN lead_master AS l ON c.lead_id = l.id LEFT JOIN payment_master AS pm ON pm.lead_id = c.lead_id LEFT JOIN payment_trans AS pt ON pm.id = pt.payment_master_id AND pt.payment_status <> 'Rejected'`;

      const params = {
        sale: [],
        collection: [],
        total: [],
      };

      // Filter by date range
      if (start_date && end_date) {
        saleVolumeQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        collectionQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        totalCollectionQuery += ` AND CAST(pt.invoice_date AS DATE) BETWEEN ? AND ?`;
        params.sale.push(start_date, end_date);
        params.collection.push(start_date, end_date);
        params.total.push(start_date, end_date);
      }

      saleVolumeQuery += ` LEFT JOIN lead_master AS l ON c.lead_id = l.id LEFT JOIN payment_master AS pm ON pm.lead_id = c.lead_id WHERE 1 = 1`;
      collectionQuery += ` LEFT JOIN lead_master AS l ON c.lead_id = l.id LEFT JOIN payment_master AS pm ON pm.lead_id = c.lead_id
      LEFT JOIN payment_trans AS pt ON pt.payment_master_id = pm.id AND pt.payment_status <> 'Rejected' WHERE 1 = 1`;
      totalCollectionQuery += ` WHERE 1 = 1`;

      if (region_id) {
        const [getRegion] = await pool.query(
          `SELECT id, name FROM region WHERE is_active = 1 AND id = ?`,
          [region_id]
        );
        if (
          getRegion[0].name === "Chennai" ||
          getRegion[0].name === "Bangalore"
        ) {
          saleVolumeQuery += ` AND b.region_id = ? AND b.name <> 'Online'`;
          collectionQuery += ` AND b.region_id = ? AND b.name <> 'Online'`;
          totalCollectionQuery += ` AND b.region_id = ? AND b.name <> 'Online'`;
        } else if (getRegion[0].name === "Hub") {
          saleVolumeQuery += ` AND b.region_id = ?`;
          collectionQuery += ` AND b.region_id = ?`;
          totalCollectionQuery += ` AND b.region_id = ?`;
        }
        params.sale.push(region_id);
        params.collection.push(region_id);
        params.total.push(region_id);
      }

      saleVolumeQuery += ` GROUP BY b.id, b.name ORDER BY sale_volume DESC`;
      collectionQuery += ` GROUP BY b.id, b.name ORDER BY collection DESC`;
      totalCollectionQuery += ` GROUP BY b.id, b.name ORDER BY total_collection DESC`;

      // Execute queries
      const [saleData] = await pool.query(saleVolumeQuery, params.sale);

      const [collectionData] = await pool.query(
        collectionQuery,
        params.collection
      );

      const [totalCollectionData] = await pool.query(
        totalCollectionQuery,
        params.total
      );

      // Map data user-wise
      const result = saleData.map((saleUser) => {
        const collectionUser = collectionData.find(
          (c) => c.branch_id === saleUser.branch_id
        ) || { collection: 0 };
        const totalUser = totalCollectionData.find(
          (t) => t.branch_id === saleUser.branch_id
        ) || { total_collection: 0 };

        const pending = saleUser.sale_volume - collectionUser.collection;

        return {
          branch_id: saleUser.branch_id,
          branch_name: saleUser.branch_name,
          sale_volume: saleUser.sale_volume,
          total_collection: totalUser.total_collection,
          pending: pending < 0 ? 0 : pending,
        };
      });

      // If specific type requested
      if (type === "Sale") {
        result.sort((a, b) => b.sale_volume - a.sale_volume);
        return result.map((r) => ({
          branch_id: r.branch_id,
          branch_name: r.branch_name,
          sale_volume: parseFloat(r.sale_volume).toFixed(2),
        }));
      }

      if (type === "Collection") {
        result.sort((a, b) => b.total_collection - a.total_collection);
        return result.map((r) => ({
          branch_id: r.branch_id,
          branch_name: r.branch_name,
          total_collection: parseFloat(r.total_collection).toFixed(2),
        }));
      }

      if (type === "Pending") {
        result.sort((a, b) => b.pending - a.pending);
        return result.map((r) => ({
          branch_id: r.branch_id,
          branch_name: r.branch_name,
          pending: parseFloat(r.pending).toFixed(2),
        }));
      }

      // Default: full scoreboard
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getBranchWiseLeadCounts: async (region_id, start_date, end_date, type) => {
    try {
      const queryParams = [];
      const followupParams = [];
      const joiningParams = [];

      let getQuery = `SELECT b.id AS branch_id, b.name AS branch_name, IFNULL(COUNT(l.id), 0) AS total_leads, SUM(CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END) AS customer_count, ROUND((SUM(CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(l.id), 0)) * 100, 2) AS percentage FROM branches AS b LEFT JOIN lead_master AS l ON b.id = l.branch_id`;

      let followupQuery = `SELECT b.id AS branch_id, b.name AS branch_name, COUNT(lfh.id) AS lead_followup_count, SUM(CASE WHEN lfh.is_updated = 1 THEN 1 ELSE 0 END) AS followup_handled, SUM(CASE WHEN lfh.is_updated = 0 THEN 1 ELSE 0 END) AS followup_unhandled, ROUND(((SUM(CASE WHEN lfh.is_updated = 1 THEN 1 ELSE 0 END) / COUNT(lfh.id)) * 100), 2) AS percentage FROM branches AS b LEFT JOIN lead_master AS l ON b.id = l.branch_id LEFT JOIN customers AS c ON c.lead_id = l.id LEFT JOIN lead_follow_up_history AS lfh ON lfh.lead_id = l.id`;

      let joiningQuery = `SELECT b.id AS branch_id, b.name AS branch_name, IFNULL(COUNT(DISTINCT c.id), 0) AS customer_count FROM branches AS b LEFT JOIN lead_master AS l ON b.id = l.branch_id LEFT JOIN customers AS c ON l.id = c.lead_id`;

      // Filter by date range
      if (start_date && end_date) {
        getQuery += ` AND CAST(l.created_date AS DATE) BETWEEN ? AND ?`;
        followupQuery += ` AND CAST(lfh.next_follow_up_date AS DATE) BETWEEN ? AND ?`;
        joiningQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        queryParams.push(start_date, end_date);
        followupParams.push(start_date, end_date);
        joiningParams.push(start_date, end_date);
      }

      getQuery += ` LEFT JOIN customers AS c ON c.lead_id = l.id WHERE 1 = 1`;
      followupQuery += ` WHERE c.id IS NULL`;
      joiningQuery += ` WHERE 1 = 1`;

      if (region_id) {
        const [getRegion] = await pool.query(
          `SELECT id, name FROM region WHERE is_active = 1 AND id = ?`,
          [region_id]
        );
        if (
          getRegion[0].name === "Chennai" ||
          getRegion[0].name === "Bangalore"
        ) {
          getQuery += ` AND b.region_id = ? AND b.name <> 'Online'`;
          followupQuery += ` AND b.region_id = ? AND b.name <> 'Online'`;
          joiningQuery += ` AND b.region_id = ? AND b.name <> 'Online'`;
        } else if (getRegion[0].name === "Hub") {
          getQuery += ` AND b.region_id = ?`;
          followupQuery += ` AND b.region_id = ?`;
          joiningQuery += ` AND b.region_id = ?`;
        }
        queryParams.push(region_id);
        followupParams.push(region_id);
        joiningParams.push(region_id);
      }

      // ✅ Order and grouping
      getQuery += ` GROUP BY b.id, b.name ORDER BY total_leads DESC`;
      followupQuery += ` GROUP BY b.id, b.name ORDER BY followup_unhandled DESC`;
      joiningQuery += ` GROUP BY b.id, b.name ORDER BY customer_count DESC`;

      switch (type) {
        case "Leads": {
          const [result] = await pool.query(getQuery, queryParams);
          const formattedResult = result.map((item) => ({
            ...item,
            percentage: item.percentage || 0.0,
          }));
          formattedResult.sort((a, b) => b.total_leads - a.total_leads);
          return formattedResult;
        }
        case "Follow Up": {
          const [followupResult] = await pool.query(
            followupQuery,
            followupParams
          );
          const formattedResult = followupResult.map((item) => ({
            ...item,
            percentage: item.percentage || 0.0,
          }));
          formattedResult.sort(
            (a, b) => b.followup_unhandled - a.followup_unhandled
          );
          return formattedResult;
        }
        case "Customer Join": {
          const [result] = await pool.query(joiningQuery, joiningParams);
          return result;
        }
        default:
          return [];
      }
    } catch (error) {
      throw new Error(error.message);
    }
  },

  downloadUserWiseLeads: async (user_ids, start_date, end_date) => {
    try {
      const queryParams = [];
      const followupParams = [];

      let getQuery = `
      SELECT 
        u.user_id, 
        u.user_name, 
        COUNT(l.id) AS total_leads,
        SUM(CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END) AS customer_count,
        ROUND(
          (SUM(CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(l.id), 0)) * 100, 
          2
        ) AS percentage
      FROM users AS u
      LEFT JOIN lead_master AS l ON u.user_id = l.assigned_to
      LEFT JOIN customers AS c ON c.lead_id = l.id
    `;

      let followupQuery = `
      SELECT 
        u.user_id, 
        u.user_name, 
        COUNT(lfh.id) AS lead_followup_count, 
        SUM(CASE WHEN lfh.is_updated = 1 THEN 1 ELSE 0 END) AS followup_handled, 
        SUM(CASE WHEN lfh.is_updated = 0 THEN 1 ELSE 0 END) AS followup_unhandled, 
        ROUND(
          (CASE WHEN COUNT(lfh.id) = 0 THEN 0 ELSE (SUM(CASE WHEN lfh.is_updated = 1 THEN 1 ELSE 0 END) / COUNT(lfh.id)) * 100 END),
          2
        ) AS percentage
      FROM users AS u
      LEFT JOIN lead_master AS l ON u.user_id = l.assigned_to
      LEFT JOIN customers AS c ON c.lead_id = l.id
      LEFT JOIN lead_follow_up_history AS lfh ON lfh.lead_id = l.id
    `;

      // Filter by date range (apply to the correct tables)
      if (start_date && end_date) {
        // leads created date
        getQuery += ` AND CAST(l.created_date AS DATE) BETWEEN ? AND ?`;
        queryParams.push(start_date, end_date);

        // followups: next_follow_up_date (as in your original code)
        followupQuery += ` AND CAST(lfh.next_follow_up_date AS DATE) BETWEEN ? AND ?`;
        followupParams.push(start_date, end_date);
      }

      // Add role filtering and any other joins already appended earlier
      getQuery += ` WHERE u.roles LIKE '%Sale%'`;
      followupQuery += ` WHERE c.id IS NULL AND u.roles LIKE '%Sale%'`;

      // Filter by user(s)
      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          getQuery += ` AND u.user_id IN (${placeholders})`;
          followupQuery += ` AND u.user_id IN (${placeholders})`;
          queryParams.push(...user_ids);
          followupParams.push(...user_ids);
        } else {
          getQuery += ` AND u.user_id = ?`;
          followupQuery += ` AND u.user_id = ?`;
          queryParams.push(user_ids);
          followupParams.push(user_ids);
        }
      }

      // Grouping & ordering (ordering here is only for individual queries; we'll resort later)
      getQuery += ` GROUP BY u.user_id, u.user_name`;
      followupQuery += ` GROUP BY u.user_id, u.user_name`;

      // Run all three queries
      const [leadsResult] = await pool.query(getQuery, queryParams);
      const [followupResult] = await pool.query(followupQuery, followupParams);

      // Merge by user_id
      const map = new Map();

      const ensureNumber = (val) => {
        if (val === null || val === undefined) return 0;
        const n = Number(val);
        return Number.isNaN(n) ? 0 : n;
      };

      // add leads data
      for (const row of leadsResult) {
        map.set(row.user_id, {
          user_id: row.user_id,
          user_name: row.user_name,
          total_leads: ensureNumber(row.total_leads),
          leads_customer_count: ensureNumber(row.customer_count),
          leads_percentage: ensureNumber(row.percentage),
          // placeholders for followup/joining
          lead_followup_count: 0,
          followup_handled: 0,
          followup_unhandled: 0,
          followup_percentage: 0.0,
        });
      }

      // merge followup data
      for (const row of followupResult) {
        const existing = map.get(row.user_id) || {
          user_id: row.user_id,
          user_name: row.user_name,
          total_leads: 0,
          leads_customer_count: 0,
          leads_percentage: 0.0,
          lead_followup_count: 0,
          followup_handled: 0,
          followup_unhandled: 0,
          followup_percentage: 0.0,
        };

        existing.lead_followup_count = ensureNumber(row.lead_followup_count);
        existing.followup_handled = ensureNumber(row.followup_handled);
        existing.followup_unhandled = ensureNumber(row.followup_unhandled);
        existing.followup_percentage = ensureNumber(row.percentage);

        map.set(row.user_id, existing);
      }

      // Build final array
      const merged = Array.from(map.values());

      // Final sort — by followup_unhandled desc (change if you prefer another metric)
      merged.sort((a, b) => b.followup_unhandled - a.followup_unhandled);

      return merged;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  downloadUserWiseScoreBoard: async (user_ids, start_date, end_date, type) => {
    try {
      const db = pool;

      // Helper
      const toNum = (v) => {
        if (v === null || v === undefined) return 0;
        const n = Number(v);
        return Number.isNaN(n) ? 0 : n;
      };

      // 1) Fetch all Sale users (optionally filter by user_ids)
      let usersQuery = `SELECT u.user_id, u.user_name FROM users u WHERE u.roles LIKE '%Sale%'`;
      const usersParams = [];
      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          usersQuery += ` AND u.user_id IN (${user_ids
            .map(() => "?")
            .join(",")})`;
          usersParams.push(...user_ids);
        } else {
          usersQuery += ` AND u.user_id = ?`;
          usersParams.push(user_ids);
        }
      }
      // optional ordering so UI is stable
      usersQuery += ` ORDER BY u.user_name`;

      const [usersRows] = await db.query(usersQuery, usersParams);

      // if no sale users found, return empty
      if (!usersRows || usersRows.length === 0) return [];

      const userIds = usersRows.map((u) => u.user_id);

      // placeholders for user ids
      const userPlaceholders = userIds.map(() => "?").join(",");

      // 2) Build & execute aggregated queries (use the same date filters you had)
      // sale volume (based on payment_master.total_amount and customers created_date filter)
      let saleQuery = `
      SELECT u.user_id, IFNULL(SUM(pm.total_amount),0) AS sale_volume
      FROM users u
      LEFT JOIN lead_master l ON l.assigned_to = u.user_id
      LEFT JOIN customers c ON c.lead_id = l.id
      LEFT JOIN payment_master pm ON pm.lead_id = c.lead_id
      WHERE u.roles LIKE '%Sale%' AND u.user_id IN (${userPlaceholders})
    `;
      const saleParams = [...userIds];
      if (start_date && end_date) {
        saleQuery += ` AND CAST(c.created_date AS DATE) BETWEEN ? AND ?`;
        saleParams.push(start_date, end_date);
      }
      saleQuery += ` GROUP BY u.user_id`;

      // collection (sum of payment_trans.amount with invoice_date filter)
      let collectionQuery = `
      SELECT u.user_id, IFNULL(SUM(pt.amount),0) AS collection
      FROM users u
      LEFT JOIN lead_master l ON l.assigned_to = u.user_id
      LEFT JOIN customers c ON c.lead_id = l.id
      LEFT JOIN payment_master pm ON pm.lead_id = c.lead_id
      LEFT JOIN payment_trans pt ON pt.payment_master_id = pm.id AND pt.payment_status <> 'Rejected'
      WHERE u.roles LIKE '%Sale%' AND u.user_id IN (${userPlaceholders})
    `;
      const collectionParams = [...userIds];
      if (start_date && end_date) {
        collectionQuery += ` AND CAST(pt.invoice_date AS DATE) BETWEEN ? AND ?`;
        collectionParams.push(start_date, end_date);
      }
      collectionQuery += ` GROUP BY u.user_id`;

      // total collection (same as collection in your earlier code; kept separately for clarity)
      let totalCollectionQuery = `
      SELECT u.user_id, IFNULL(SUM(pt.amount),0) AS total_collection
      FROM users u
      LEFT JOIN lead_master l ON l.assigned_to = u.user_id
      LEFT JOIN customers c ON c.lead_id = l.id
      LEFT JOIN payment_master pm ON pm.lead_id = c.lead_id
      LEFT JOIN payment_trans pt ON pt.payment_master_id = pm.id AND pt.payment_status <> 'Rejected'
      WHERE u.roles LIKE '%Sale%' AND u.user_id IN (${userPlaceholders})
    `;
      const totalParams = [...userIds];
      if (start_date && end_date) {
        totalCollectionQuery += ` AND CAST(pt.invoice_date AS DATE) BETWEEN ? AND ?`;
        totalParams.push(start_date, end_date);
      }
      totalCollectionQuery += ` GROUP BY u.user_id`;

      // Execute queries in parallel
      const [saleRowsPromise, collectionRowsPromise, totalRowsPromise] =
        await Promise.all([
          db.query(saleQuery, saleParams),
          db.query(collectionQuery, collectionParams),
          db.query(totalCollectionQuery, totalParams),
        ]);

      const saleRows = saleRowsPromise[0] || [];
      const collectionRows = collectionRowsPromise[0] || [];
      const totalRows = totalRowsPromise[0] || [];

      // Convert aggregated results to maps for quick lookup
      const saleMap = saleRows.reduce((acc, r) => {
        acc[r.user_id] = toNum(r.sale_volume);
        return acc;
      }, {});
      const collectionMap = collectionRows.reduce((acc, r) => {
        acc[r.user_id] = toNum(r.collection);
        return acc;
      }, {});
      const totalMap = totalRows.reduce((acc, r) => {
        acc[r.user_id] = toNum(r.total_collection);
        return acc;
      }, {});

      // 3) Fetch targets for all users in one query (matching your target_month format)
      // Build target_month string as in your current logic
      const targetMonthStr = `CONCAT(DATE_FORMAT(?, '%b %Y'), ' - ', DATE_FORMAT(?, '%b %Y'))`;
      const targetQuery = `
      SELECT ut.user_id, ut.target_month, ut.target_value
      FROM user_target_master ut
      JOIN (
        SELECT user_id, MAX(id) AS mx
        FROM user_target_master
        WHERE target_month = ${targetMonthStr}
        AND user_id IN (${userPlaceholders})
        GROUP BY user_id
      ) t ON t.user_id = ut.user_id AND t.mx = ut.id
    `;
      // params: start_date, end_date for the DATE_FORMAT placeholders, then userIds
      const targetParams = [start_date, end_date, ...userIds];
      const [targetRows] = await db.query(targetQuery, targetParams);
      const targetMap = (targetRows || []).reduce((acc, r) => {
        acc[r.user_id] = {
          target_month: r.target_month,
          target_value: toNum(r.target_value),
        };
        return acc;
      }, {});

      // 4) Merge everything into final array (includes all Sale users)
      const final = usersRows.map((u) => {
        const sale_volume = toNum(saleMap[u.user_id] ?? 0);
        const collection = toNum(collectionMap[u.user_id] ?? 0);
        const total_collection = toNum(totalMap[u.user_id] ?? 0);

        const pending = Math.max(0, sale_volume - collection);
        const targetObj = targetMap[u.user_id] || {
          target_month: "",
          target_value: 0,
        };
        const target_value = toNum(targetObj.target_value);
        const target_percentage =
          target_value > 0
            ? Number(((total_collection / target_value) * 100).toFixed(2))
            : 0;

        return {
          user_id: u.user_id,
          user_name: u.user_name,
          sale_volume: Number(sale_volume.toFixed(2)),
          collection: Number(collection.toFixed(2)),
          total_collection: Number(total_collection.toFixed(2)),
          pending: Number(pending.toFixed(2)),
          target_month: targetObj.target_month,
          target_value: Number(target_value.toFixed(2)),
          target_percentage,
        };
      });

      // 5) Return views based on 'type'
      if (type === "Sale") {
        final.sort((a, b) => b.sale_volume - a.sale_volume);
        return final.map((r) => ({
          user_id: r.user_id,
          user_name: r.user_name,
          sale_volume: r.sale_volume.toFixed(2),
        }));
      }

      if (type === "Collection") {
        final.sort((a, b) => b.total_collection - a.total_collection);
        return final.map((r) => ({
          user_id: r.user_id,
          user_name: r.user_name,
          total_collection: r.total_collection.toFixed(2),
          target_month: r.target_month,
          target_value: r.target_value.toFixed(2),
          percentage: r.target_percentage,
        }));
      }

      if (type === "Pending") {
        final.sort((a, b) => b.pending - a.pending);
        return final.map((r) => ({
          user_id: r.user_id,
          user_name: r.user_name,
          pending: r.pending.toFixed(2),
        }));
      }

      // Default: full scoreboard sorted by sale_volume desc
      final.sort((a, b) => b.sale_volume - a.sale_volume);
      return final;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  qualityProductivity: async (user_ids, start_date, end_date, type) => {
    try {
      const queryParams = [];
      const followUpParams = [];
      let getQuery = `SELECT u.user_id, u.user_name, IFNULL(COUNT(qm.id), 0) AS productivity_count, IFNULL(SUM(CASE WHEN qm.status = 3 THEN 1 ELSE 0 END), 0) AS cna_moved, IFNULL(SUM(CASE WHEN qm.status <> 3 AND qm.cna_date IS NOT NULL THEN 1 ELSE 0 END), 0) AS cna_reached, IFNULL(SUM(CASE WHEN qm.status <> 3 AND qm.cna_date IS NULL THEN 1 ELSE 0 END), 0) AS direct_reached FROM users AS u LEFT JOIN quality_master AS qm ON u.user_id = qm.updated_by AND qm.is_updated = 1`;

      let followUpQuery = `SELECT u.user_id, u.user_name, IFNULL(COUNT(qm.id), 0) AS total_followups, IFNULL(SUM(CASE WHEN qm.is_updated = 1 THEN 1 ELSE 0 END), 0) AS follow_up_handled, IFNULL(SUM(CASE WHEN qm.is_updated = 0 THEN 1 ELSE 0 END), 0) AS follow_up_unhandled FROM users AS u LEFT JOIN quality_master AS qm ON u.user_id = qm.updated_by`;

      if (start_date && end_date) {
        getQuery += ` AND CAST(qm.updated_date AS DATE) BETWEEN ? AND ?`;
        followUpQuery += ` AND CAST(qm.cna_date AS DATE) BETWEEN ? AND ?`;
        queryParams.push(start_date, end_date);
        followUpParams.push(start_date, end_date);
      }

      getQuery += ` WHERE u.roles LIKE '%Quality%'`;
      followUpQuery += ` WHERE u.roles LIKE '%Quality%'`;

      if (user_ids) {
        if (Array.isArray(user_ids) && user_ids.length > 0) {
          const placeholders = user_ids.map(() => "?").join(", ");
          getQuery += ` AND u.user_id IN (${placeholders})`;
          followUpQuery += ` AND u.user_id IN (${placeholders})`;
          queryParams.push(...user_ids);
          followUpParams.push(...user_ids);
        } else {
          getQuery += ` AND u.user_id = ?`;
          followUpQuery += ` AND u.user_id = ?`;
          queryParams.push(user_ids);
          followUpParams.push(user_ids);
        }
      }

      getQuery += ` GROUP BY u.user_id, u.user_name`;
      followUpQuery += ` GROUP BY u.user_id, u.user_name ORDER BY total_followups DESC`;

      const [getUsers] = await pool.query(
        `SELECT user_id, user_name FROM users WHERE roles LIKE '%Quality%'`
      );

      const [productivityResult] = await pool.query(getQuery, queryParams);
      const [followupResult] = await pool.query(followUpQuery, followUpParams);

      // If user only asked for raw Productivity or Followup, return them directly
      if (type === "Productivity") {
        return productivityResult;
      }
      if (type === "Followup") {
        return followupResult;
      }

      const formattedResult = getUsers.map((item) => {
        const filterProductivity =
          productivityResult.find((p) => p.user_id === item.user_id) || {};
        const followupFilter =
          followupResult.find((f) => f.user_id === item.user_id) || {};

        return {
          ...item,
          productivity_count: filterProductivity.productivity_count,
          cna_moved: filterProductivity.cna_moved,
          cna_reached: filterProductivity.cna_reached,
          direct_reached: filterProductivity.direct_reached,
          total_followups: followupFilter.total_followups,
          follow_up_handled: followupFilter.follow_up_handled,
          follow_up_unhandled: followupFilter.follow_up_unhandled,
        };
      });

      return formattedResult;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  postSalePerformance: async (user_ids, start_date, end_date) => {
    try {
      const queryParams = [];
      let sql = `SELECT SUM(CASE WHEN c.status = 'Awaiting Trainer' THEN 1 ELSE 0 END) AS awaiting_trainer, SUM(CASE WHEN c.status = 'Awaiting Trainer Verify' THEN 1 ELSE 0 END) AS awaiting_trainer_verify, SUM(CASE WHEN c.status = 'Trainer Rejected' THEN 1 ELSE 0 END) AS rejected_trainer, SUM(CASE WHEN c.status = 'Awaiting Class' THEN 1 ELSE 0 END) AS verified_trainer, SUM(CASE WHEN c.status = 'Awaiting Verify' THEN 1 ELSE 0 END) AS awaiting_verify, SUM(CASE WHEN c.status = 'Awaiting Class' THEN 1 ELSE 0 END) AS awaiting_class, SUM(CASE WHEN c.status = 'Class Scheduled' THEN 1 ELSE 0 END) AS class_scheduled, SUM(CASE WHEN c.status = 'Escalated' THEN 1 ELSE 0 END) AS escalated, SUM(CASE WHEN c.status = 'Class Going' THEN 1 ELSE 0 END) AS class_going, SUM(CASE WHEN c.google_review IS NOT NULL THEN 1 ELSE 0 END) AS google_review_count, SUM(CASE WHEN c.linkedin_review IS NOT NULL THEN 1 ELSE 0 END) AS linkedin_review_count, SUM(CASE WHEN c.status = 'Completed' THEN 1 ELSE 0 END) AS class_completed, SUM(CASE WHEN c.status = 'Videos Given' THEN 1 ELSE 0 END) AS videos_given FROM customers AS c INNER JOIN lead_master AS l ON c.lead_id = l.id WHERE 1 = 1`;

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
};

module.exports = DashboardModel;
