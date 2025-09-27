const pool = require("../config/dbconfig");

const PageAccessModel = {
  getPermissions: async () => {
    try {
      const sql = `SELECT permission_id, permission_name, CASE WHEN is_active = 1 THEN 1 ELSE 0 END AS is_active FROM permissions WHERE is_active = 1 ORDER BY permission_id ASC`;
      const [result] = await pool.query(sql);
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  insertPermission: async (permission_name) => {
    try {
      const [isExists] = await pool.query(
        `SELECT id FROM permissions WHERE permission_name = ? AND is_active = 1`,
        [permission_name]
      );
      if (isExists.length > 0) throw new Error("The permission already exists");
      const sql = `INSERT INTO permissions(permission_name) VALUES(?)`;
      const values = [permission_name];
      const [result] = await pool.query(sql, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getRoles: async () => {
    try {
      const sql = `SELECT role_id, role_name, background_color, text_color, CASE WHEN is_active = 1 THEN 1 ELSE 0 END AS is_active FROM roles WHERE is_active = 1 ORDER BY role_id ASC`;
      const [result] = await pool.query(sql);
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  insertRoles: async (role_name, background_color, text_color) => {
    try {
      const [isExists] = await pool.query(
        `SELECT role_id FROM roles WHERE role_name = ? AND is_active = 1`,
        [role_name]
      );
      if (isExists.length > 0) throw new Error("The role name already exists");
      const sql = `INSERT INTO roles(role_name, background_color, text_color) VALUES(?, ?, ?)`;
      const values = [role_name, background_color, text_color];
      const [result] = await pool.query(sql, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateRole: async (role_name, role_id) => {
    try {
      const [isExists] = await pool.query(
        `SELECT role_id FROM roles WHERE role_id = ? AND is_active = 1`,
        [role_id]
      );
      if (isExists.length <= 0) throw new Error("Invalid role Id");

      const [isNameExists] = await pool.query(
        `SELECT role_id FROM roles WHERE role_name = ? AND role_id <> ?`,
        [role_name, role_id]
      );

      if (isNameExists.length > 0) throw new Error("Role name already exists");
      const sql = `UPDATE
                      roles
                  SET
                      role_name = ?
                  WHERE
                      role_id = ?`;
      const values = [role_name, role_id];
      const [result] = await pool.query(sql, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  deleteRole: async (role_id) => {
    try {
      const [isExists] = await pool.query(
        `SELECT role_id FROM roles WHERE role_id = ? AND is_active = 1`,
        [role_id]
      );
      if (isExists.length <= 0) throw new Error("Invalid role Id");

      const [isRoleMapped] = await pool.query(
        `SELECT COUNT(id) AS count FROM role_permissions WHERE role_id = ?`,
        [role_id]
      );
      if (isRoleMapped[0].count > 0)
        throw new Error(
          "Can't be able to delete this role, kindly un-map from role_permissions table"
        );

      const [result] = await pool.query(`DELETE FROM roles WHERE role_id = ?`, [
        role_id,
      ]);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getGroups: async () => {
    try {
      const sql = `SELECT
                      group_id,
                      group_name,
                      description,
                      background_color,
                      text_color,
                      CASE WHEN is_active = 1 THEN 1 ELSE 0 END AS is_active
                  FROM groups WHERE is_active = 1`;
      const [result] = await pool.query(sql);
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  insertGroups: async (
    group_name,
    description,
    background_color,
    text_color
  ) => {
    try {
      const [isExists] = await pool.query(
        `SELECT group_id FROM groups WHERE group_name = ? AND is_active = 1`,
        [group_name]
      );
      if (isExists.length > 0) throw new Error("The group name already exists");
      const sql = `INSERT INTO groups(group_name, description, background_color, text_color) VALUES(?, ?, ?, ?)`;
      const values = [group_name, description, background_color, text_color];
      const [result] = await pool.query(sql, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  updateGroup: async (group_name, description, group_id) => {
    try {
      const [isExists] = await pool.query(
        `SELECT group_id FROM groups WHERE group_id = ? AND is_active = 1`,
        [group_id]
      );
      if (isExists.length <= 0) throw new Error("Invalid group Id");

      const [isNameExists] = await pool.query(
        `SELECT group_id FROM groups WHERE group_name = ? AND group_id <> ?`,
        [group_name, group_id]
      );

      if (isNameExists.length > 0) throw new Error("Role name already exists");
      const sql = `UPDATE
                      groups
                  SET
                      group_name = ?,
                      description = ?
                  WHERE
                      group_id = ?`;
      const values = [group_name, description, group_id];
      const [result] = await pool.query(sql, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  deleteGroup: async (group_id) => {
    try {
      const [isExists] = await pool.query(
        `SELECT group_id FROM groups WHERE group_id  = ? AND is_active = 1`,
        [group_id]
      );
      if (isExists.length <= 0) throw new Error("Invalid geoup Id");

      const [isGroupMapped] = await pool.query(
        `SELECT COUNT(id) AS count FROM user_group_roles WHERE group_id = ?`,
        [group_id]
      );
      if (isGroupMapped[0].count > 0)
        throw new Error(
          "Can't be able to delete this group, kindly un-map from user_group_roles table"
        );

      const [result] = await pool.query(
        `DELETE FROM groups WHERE group_id  = ?`,
        [group_id]
      );
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  getRolePermissions: async () => {
    try {
      const sql = `SELECT role_id, permission_id FROM role_permissions`;
      const [result] = await pool.query(sql);
      return result;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  insertRolePermissions: async (role_id, permission_id) => {
    try {
      const [isExists] = await pool.query(
        `SELECT id FROM role_permissions WHERE role_id = ? AND permission_id = ?`,
        [role_id, permission_id]
      );
      if (isExists.length > 0)
        throw new Error("Permission has already been mapped this role");
      const sql = `INSERT INTO role_permissions(role_id, permission_id) VALUES(?, ?)`;
      const values = [role_id, permission_id];
      const [result] = await pool.query(sql, values);
      return result.affectedRows;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};

module.exports = PageAccessModel;
