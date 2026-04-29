const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const config = {
  server: '10.0.0.7',
  database: 'Total ETO',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    trustedConnection: true,
  },
};

async function main() {
  const pool = await sql.connect(config);

  // BOM Spec 10
  console.log('Fetching BOM spec 10...');
  const bom10 = await pool.request()
    .input('projectId', sql.Int, 1129)
    .input('specId', sql.Int, 10)
    .query(`
      SELECT
        eps.ChildID, child.ItemCompanyID AS ChildPN, child.ItemDescription AS ChildDesc,
        eps.ParentID, parent.ItemCompanyID AS ParentPN, parent.ItemDescription AS ParentDesc,
        eps.ItemQty, eps.SpecID, eps.RequiredDate,
        ISNULL((SELECT SUM(pod.PurchaseQty) FROM tblPurchaseOrderDetails pod WHERE pod.ProjectID = @projectId AND pod.ItemID = eps.ChildID), 0) AS POQty,
        ISNULL((SELECT SUM(rl.QtyReceived) FROM tblReceiverLog rl JOIN tblPurchaseOrderDetails pod2 ON rl.PurchaseDetailID = pod2.PurchaseDetailID WHERE pod2.ProjectID = @projectId AND pod2.ItemID = eps.ChildID), 0) AS ReceivedQty
      FROM tblEngProductStructure eps
      JOIN tblEngItemMaster child ON eps.ChildID = child.ItemID
      JOIN tblEngItemMaster parent ON eps.ParentID = parent.ItemID
      WHERE eps.ProjectID = @projectId AND eps.SpecID = @specId
      ORDER BY parent.ItemCompanyID, child.ItemCompanyID
    `);
  fs.writeFileSync(path.join(__dirname, 'server/cache/bom_1129_10.json'), JSON.stringify(bom10.recordset, null, 2));
  console.log('BOM spec 10:', bom10.recordset.length, 'rows');

  // BOM Spec 30
  console.log('Fetching BOM spec 30...');
  const bom30 = await pool.request()
    .input('projectId', sql.Int, 1129)
    .input('specId', sql.Int, 30)
    .query(`
      SELECT
        eps.ChildID, child.ItemCompanyID AS ChildPN, child.ItemDescription AS ChildDesc,
        eps.ParentID, parent.ItemCompanyID AS ParentPN, parent.ItemDescription AS ParentDesc,
        eps.ItemQty, eps.SpecID, eps.RequiredDate,
        ISNULL((SELECT SUM(pod.PurchaseQty) FROM tblPurchaseOrderDetails pod WHERE pod.ProjectID = @projectId AND pod.ItemID = eps.ChildID), 0) AS POQty,
        ISNULL((SELECT SUM(rl.QtyReceived) FROM tblReceiverLog rl JOIN tblPurchaseOrderDetails pod2 ON rl.PurchaseDetailID = pod2.PurchaseDetailID WHERE pod2.ProjectID = @projectId AND pod2.ItemID = eps.ChildID), 0) AS ReceivedQty
      FROM tblEngProductStructure eps
      JOIN tblEngItemMaster child ON eps.ChildID = child.ItemID
      JOIN tblEngItemMaster parent ON eps.ParentID = parent.ItemID
      WHERE eps.ProjectID = @projectId AND eps.SpecID = @specId
      ORDER BY parent.ItemCompanyID, child.ItemCompanyID
    `);
  fs.writeFileSync(path.join(__dirname, 'server/cache/bom_1129_30.json'), JSON.stringify(bom30.recordset, null, 2));
  console.log('BOM spec 30:', bom30.recordset.length, 'rows');

  // PO Details
  console.log('Fetching PO details...');
  const po = await pool.request()
    .input('projectId', sql.Int, 1129)
    .query(`
      SELECT
        poh.PurchaseOrderID, poh.PurchaseDate, poh.PurchaseDateRequired,
        c.CName AS Supplier, c.DefaultEmailAddress AS SupplierEmail, c.CPhone AS SupplierPhone,
        pod.PurchaseDetailID, pod.SpecID, pod.ItemID,
        eim.ItemCompanyID AS PartNumber, eim.ItemDescription AS PartDesc,
        pod.PurchaseQty, pod.PurchasePrice, pod.DateRequired,
        ISNULL((SELECT SUM(rl.QtyReceived) FROM tblReceiverLog rl WHERE rl.PurchaseDetailID = pod.PurchaseDetailID), 0) AS ReceivedQty
      FROM tblPurchaseOrderDetails pod
      JOIN tblPurchaseOrderHeader poh ON pod.PurchaseOrderID = poh.PurchaseOrderID
      JOIN tblCompany c ON poh.PurchaseSupplierID = c.CompanyID
      JOIN tblEngItemMaster eim ON pod.ItemID = eim.ItemID
      WHERE pod.ProjectID = @projectId
        AND eim.ItemCompanyID NOT IN ('Shipping', 'FEE', 'TARIFF')
      ORDER BY c.CName, pod.DateRequired
    `);
  fs.writeFileSync(path.join(__dirname, 'server/cache/po_1129.json'), JSON.stringify(po.recordset, null, 2));
  console.log('PO details:', po.recordset.length, 'rows');

  await pool.close();
  console.log('Done - all 1129 cache files saved.');
}

main().catch(err => { console.error(err); process.exit(1); });
