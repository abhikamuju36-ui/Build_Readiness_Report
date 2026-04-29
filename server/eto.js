const sql = require('mssql');

let pool = null;

const config = {
  server: process.env.ETO_HOST,
  database: process.env.ETO_DATABASE,
  user: process.env.ETO_USER,
  password: process.env.ETO_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

async function getPool() {
  if (!config.server) {
    throw new Error('ETO database not configured. Fill in .env with ETO_HOST, ETO_DATABASE, ETO_USER, ETO_PASSWORD.');
  }
  if (!pool) {
    pool = await sql.connect(config);
  }
  return pool;
}

// ---------- Queries ----------

async function getSpecs(projectId) {
  const db = await getPool();
  const result = await db.request()
    .input('projectId', sql.Int, projectId)
    .query(`
      SELECT SpecAutoID, SpecID, SDescription, SQuantity
      FROM tblSpec
      WHERE ProjectID = @projectId
      ORDER BY SpecID
    `);
  return result.recordset;
}

async function getTopNode(projectId, specId) {
  const db = await getPool();
  const result = await db.request()
    .input('projectId', sql.Int, projectId)
    .input('specId', sql.Int, specId)
    .query(`
      SELECT et.ItemID as TopItemID, eim.ItemCompanyID as TopPN, eim.ItemDescription as TopDesc
      FROM tblEngTop et
      JOIN tblEngItemMaster eim ON et.ItemID = eim.ItemID
      WHERE et.ProjectID = @projectId AND et.SpecID = @specId
    `);
  return result.recordset[0] || null;
}

async function getBomRows(projectId, specId) {
  const db = await getPool();
  const result = await db.request()
    .input('projectId', sql.Int, projectId)
    .input('specId', sql.Int, specId)
    .query(`
      SELECT
        eps.ChildID,
        child.ItemCompanyID  AS ChildPN,
        child.ItemDescription AS ChildDesc,
        eps.ParentID,
        parent.ItemCompanyID AS ParentPN,
        parent.ItemDescription AS ParentDesc,
        eps.ItemQty,
        eps.SpecID,
        eps.RequiredDate,
        ISNULL((
          SELECT SUM(pod.PurchaseQty)
          FROM tblPurchaseOrderDetails pod
          WHERE pod.ProjectID = @projectId AND pod.ItemID = eps.ChildID
        ), 0) AS POQty,
        ISNULL((
          SELECT SUM(rl.QtyReceived)
          FROM tblReceiverLog rl
          JOIN tblPurchaseOrderDetails pod2
            ON rl.PurchaseDetailID = pod2.PurchaseDetailID
          WHERE pod2.ProjectID = @projectId AND pod2.ItemID = eps.ChildID
        ), 0) AS ReceivedQty
      FROM tblEngProductStructure eps
      JOIN tblEngItemMaster child  ON eps.ChildID  = child.ItemID
      JOIN tblEngItemMaster parent ON eps.ParentID = parent.ItemID
      WHERE eps.ProjectID = @projectId AND eps.SpecID = @specId
      ORDER BY parent.ItemCompanyID, child.ItemCompanyID
    `);
  return result.recordset;
}

async function getPoDetails(projectId) {
  const db = await getPool();
  const result = await db.request()
    .input('projectId', sql.Int, projectId)
    .query(`
      SELECT
        poh.PurchaseOrderID,
        poh.PurchaseDate,
        poh.PurchaseDateRequired,
        c.CName           AS Supplier,
        c.DefaultEmailAddress AS SupplierEmail,
        c.CPhone           AS SupplierPhone,
        pod.PurchaseDetailID,
        pod.SpecID,
        pod.ItemID,
        eim.ItemCompanyID  AS PartNumber,
        eim.ItemDescription AS PartDesc,
        pod.PurchaseQty,
        pod.PurchasePrice,
        pod.DateRequired,
        ISNULL((
          SELECT SUM(rl.QtyReceived)
          FROM tblReceiverLog rl
          WHERE rl.PurchaseDetailID = pod.PurchaseDetailID
        ), 0) AS ReceivedQty
      FROM tblPurchaseOrderDetails pod
      JOIN tblPurchaseOrderHeader poh ON pod.PurchaseOrderID = poh.PurchaseOrderID
      JOIN tblCompany c              ON poh.PurchaseSupplierID = c.CompanyID
      JOIN tblEngItemMaster eim      ON pod.ItemID = eim.ItemID
      WHERE pod.ProjectID = @projectId
        AND eim.ItemCompanyID NOT IN ('Shipping', 'FEE', 'TARIFF')
      ORDER BY c.CName, pod.DateRequired
    `);
  return result.recordset;
}

async function getProjectInfo(projectId) {
  const db = await getPool();
  const result = await db.request()
    .input('projectId', sql.Int, projectId)
    .query(`
      SELECT TOP 1 ProjectID, ProjectName, ProjectDescription
      FROM tblProjects
      WHERE ProjectID = @projectId
    `);
  return result.recordset[0] || null;
}

module.exports = {
  getSpecs,
  getTopNode,
  getBomRows,
  getPoDetails,
  getProjectInfo,
};
