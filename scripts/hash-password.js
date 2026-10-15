import bcrypt from "bcryptjs";

const rawPassword = process.argv[2];
const username = process.argv[3] || "admin";

if (!rawPassword) {
  console.log("\nUso:");
  console.log("  node scripts/hash-password.js <contraseña> [usuario]");
  console.log("\nEjemplo:");
  console.log("  node scripts/hash-password.js MiClaveSegura2026! admin\n");
  process.exit(1);
}

async function generate() {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(rawPassword, salt);

  console.log("\n=======================================================");
  console.log("🔐 GENERADOR DE HASH BCRYPT PARA ORACLE");
  console.log("=======================================================");
  console.log(`Usuario:     ${username}`);
  console.log(`Contraseña:  ${rawPassword}`);
  console.log(`Hash Bcrypt: ${hash}`);
  console.log("\nSentencia SQL para ejecutar en Oracle (DBeaver / SQL*Plus):");
  console.log("-------------------------------------------------------");
  console.log(`UPDATE WEBPORTAL.USUARIO`);
  console.log(`SET CLAVE = '${hash}', CAMBIOCLV = 'N', STSUSU = 'ACT'`);
  console.log(`WHERE CODUSU = '${username}';`);
  console.log(`COMMIT;`);
  console.log("=======================================================\n");
}

generate();
