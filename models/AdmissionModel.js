const pool = require("../config/dbconfig");
const { CONSTANT_STATUS } = require("../constants/constant");

const AdmissionModel = {
  getAdmissions: async (
    from_date,
    to_date,
    search_filter,
    user_ids,
    page,
    limit,
    bucket,
    region_id,
    branch_id,
  ) => {
    try {
      const queryParams = [];
      const countParams = [];
      const regionParams = [];

      // Get customers query
      let getQuery = `SELECT
                        ROW_NUMBER() OVER (ORDER BY COALESCE(c.date_of_joining, c.created_date) DESC, c.id DESC) AS row_num,
                        c.id AS customer_id,
                        COALESCE(c.date_of_joining, c.created_date) AS date_of_joining,
                        COALESCE(c.student_id, c.name) AS student_id,
                        t.id AS course_id,
                        t.name AS course_name,
                        lm.assigned_to,
                        b.id as branch_id,
                        r.id as region_id,
                        b.name as branch_name,
                        r.name as region_name,
                        su.user_name AS sale_executive,
                        hu.user_id AS hr_user_id,
                        hu.user_name AS hr_user_name,
                        ra.user_id AS ra_user_id,
                        ra.user_name AS ra_user_name
                    FROM
                        customers AS c
                    INNER JOIN technologies AS t ON
                        t.id = c.enrolled_course
                    INNER JOIN lead_master AS lm ON
                        lm.id = c.lead_id
                    LEFT JOIN users AS su ON
                        su.user_id = lm.assigned_to
                    LEFT JOIN(
                        SELECT ct.customer_id,
                            MAX(ct.id) AS latest_id
                        FROM
                            customer_track AS ct
                        WHERE ct.status = 'Trainer Assigned'
                        GROUP BY ct.customer_id
                    ) AS latest_hr ON
                        latest_hr.customer_id = c.id
                    LEFT JOIN customer_track AS ht ON
                        ht.id = latest_hr.latest_id
                    LEFT JOIN users AS hu ON
                        hu.user_id = ht.updated_by
                    LEFT JOIN(
                        SELECT ct.customer_id,
                            MAX(ct.id) AS latest_id
                        FROM
                            customer_track AS ct
                        WHERE ct.status = 'Student Verified'
                        GROUP BY ct.customer_id
                    ) AS latest_ra ON
                        latest_ra.customer_id = c.id
                    LEFT JOIN customer_track AS rt ON
                        rt.id = latest_ra.latest_id
                    LEFT JOIN users AS ra ON
                        ra.user_id = rt.updated_by
                    LEFT JOIN class_mode AS cm ON
                        c.mode_of_class = cm.id
                    LEFT JOIN branches AS b ON
                        su.branch_id = b.id
                    LEFT JOIN region AS r ON
                        b.region_id = r.id
                    WHERE 1 = 1`;

      // Get pagination count query
      let countQuery = `SELECT
                            COUNT(c.id) AS total
                        FROM
                            customers AS c
                        INNER JOIN technologies AS t ON
                            t.id = c.enrolled_course
                        INNER JOIN lead_master AS lm ON
                            lm.id = c.lead_id
                        LEFT JOIN users AS su ON
                            su.user_id = lm.assigned_to
                        LEFT JOIN class_mode AS cm ON
                            c.mode_of_class = cm.id
                        LEFT JOIN branches AS b ON
                            su.branch_id = b.id
                        LEFT JOIN region AS r ON
                        b.region_id = r.id
                        WHERE 1 = 1`;

      let cmCondition = bucket ? ` AND cm.name = '${bucket}'` : "";

      let regionQuery = `SELECT
                            SUM(CASE WHEN cm.name = 'Online' THEN 1 ELSE 0 END) AS online_mode,
                            SUM(CASE WHEN cm.name = 'Classroom' THEN 1 ELSE 0 END) AS classroom_mode,
                            SUM(CASE WHEN lm.assigned_to LIKE '%${CONSTANT_STATUS.CHENNAI}%' ${cmCondition} THEN 1 ELSE 0 END) AS chennai_region,
                            SUM(CASE WHEN lm.assigned_to LIKE '%${CONSTANT_STATUS.BANGALORE}%' ${cmCondition} THEN 1 ELSE 0 END) AS bangalore_region,
                            SUM(CASE WHEN lm.assigned_to LIKE '%${CONSTANT_STATUS.ONLINE}%' ${cmCondition} THEN 1 ELSE 0 END) AS hub_region
                        FROM
                            customers AS c
                        INNER JOIN technologies AS t ON
                            t.id = c.enrolled_course
                        INNER JOIN lead_master AS lm ON
                            lm.id = c.lead_id
                        LEFT JOIN users AS su ON
                            su.user_id = lm.assigned_to
                        LEFT JOIN branches AS b ON
                            su.branch_id = b.id
                        LEFT JOIN region AS r ON
                        b.region_id = r.id
                        LEFT JOIN class_mode AS cm ON
                            c.mode_of_class = cm.id
                        WHERE 1 = 1`;

      if (bucket && bucket === "Online") {
        getQuery += ` AND cm.name = 'Online'`;
        countQuery += ` AND cm.name = 'Online'`;
      }

      if (bucket && bucket === "Classroom") {
        getQuery += ` AND cm.name = 'Classroom'`;
        countQuery += ` AND cm.name = 'Classroom'`;
      }

      // Handle user_ids parameter for both queries
      if (user_ids && Array.isArray(user_ids) && user_ids.length > 0) {
        const placeholders = user_ids.map(() => "?").join(", ");
        const userFilter = ` AND lm.assigned_to IN (${placeholders})`;
        getQuery += userFilter;
        countQuery += userFilter;
        regionQuery += userFilter;
        queryParams.push(...user_ids);
        countParams.push(...user_ids);
        regionParams.push(...user_ids);
      }

      // Add date range filter
      if (from_date && to_date) {
        getQuery += ` AND COALESCE(c.date_of_joining, c.created_date) >= ? AND COALESCE(c.date_of_joining, c.created_date) < DATE_ADD(?, INTERVAL 1 DAY)`;
        countQuery += ` AND COALESCE(c.date_of_joining, c.created_date) >= ? AND COALESCE(c.date_of_joining, c.created_date) < DATE_ADD(?, INTERVAL 1 DAY)`;
        regionQuery += ` AND COALESCE(c.date_of_joining, c.created_date) >= ? AND COALESCE(c.date_of_joining, c.created_date) < DATE_ADD(?, INTERVAL 1 DAY)`;
        queryParams.push(from_date, to_date);
        countParams.push(from_date, to_date);
        regionParams.push(from_date, to_date);
      }

      if (region_id) {
        getQuery += `
        AND r.id = ?
      `;
        countQuery += `  AND r.id = ?
      `;
        regionQuery += `  AND r.id = ?
      `;

        queryParams.push(region_id);
        countParams.push(region_id);
        regionParams.push(region_id);
      }

      if (branch_id) {
        getQuery += `
        AND b.id = ?
      `;
        countQuery += `  AND b.id = ?
      `;
        regionQuery += `  AND b.id = ?
      `;

        queryParams.push(branch_id);
        countParams.push(branch_id);
        regionParams.push(branch_id);
      }

      // search filter
      if (search_filter) {
        const filterQuery = ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR t.name LIKE ? OR c.student_id LIKE ?)`;
        getQuery += filterQuery;
        countQuery += filterQuery;
        regionQuery += filterQuery;
        queryParams.push(
          `%${search_filter}%`,
          `%${search_filter}%`,
          `%${search_filter}%`,
          `%${search_filter}%`,
          `%${search_filter}%`,
        );
        countParams.push(
          `%${search_filter}%`,
          `%${search_filter}%`,
          `%${search_filter}%`,
          `%${search_filter}%`,
          `%${search_filter}%`,
        );
        regionParams.push(
          `%${search_filter}%`,
          `%${search_filter}%`,
          `%${search_filter}%`,
          `%${search_filter}%`,
          `%${search_filter}%`,
        );
      }

      // Apply pagination
      const pageNumber = parseInt(page, 10) || 1;
      const limitNumber = parseInt(limit, 10) || 10;
      const offset = (pageNumber - 1) * limitNumber;

      // Add pagination to main query
      getQuery += ` ORDER BY COALESCE(c.date_of_joining, c.created_date) DESC, c.id DESC LIMIT ? OFFSET ?`;
      queryParams.push(limitNumber, offset);

      // Fetch all required data concurrently
      const [[countResult], [result], [regionResult]] = await Promise.all([
        pool.query(countQuery, countParams),
        pool.query(getQuery, queryParams),
        pool.query(regionQuery, regionParams),
      ]);

      // Get total count
      const total = countResult[0]?.total || 0;
      const onlineMode = regionResult[0]?.online_mode || 0;
      const classroomMode = regionResult[0]?.classroom_mode || 0;
      const chennai = regionResult[0]?.chennai_region || 0;
      const bangalore = regionResult[0]?.bangalore_region || 0;
      const hub = regionResult[0]?.hub_region || 0;

      // Return customer result
      return {
        customers: result,
        pagination: {
          total: parseInt(total),
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(total / limitNumber),
        },
        online_mode: parseInt(onlineMode),
        classroom_mode: parseInt(classroomMode),
        chennai_region: parseInt(chennai),
        bangalore_region: parseInt(bangalore),
        hub_region: parseInt(hub),
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = AdmissionModel;
