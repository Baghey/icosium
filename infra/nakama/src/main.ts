/**
 * Module serveur d'ICOSIUM chargé par Nakama.
 *
 * Règle : âge minimum 16 ans. Le serveur vérifie la date de naissance à la création d'un
 * compte email ; un compte invité doit confirmer avoir 16 ans ou plus. Le client ne peut pas
 * contourner ces vérifications.
 *
 * Nakama exige des fonctions globales nommées : ce fichier n'utilise ni import ni export.
 * La logique d'âge reprend celle de packages/shared/src/age.ts (couverte par les tests) ;
 * garder les deux identiques.
 */

var ICOSIUM_MIN_AGE = 16;
var INVALID_ARGUMENT = 3;

function icosiumAge(birthdate: string, now: Date): number | null {
  var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate);
  if (!match) return null;
  var year = Number(match[1]);
  var month = Number(match[2]);
  var day = Number(match[3]);
  var date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  var age = now.getUTCFullYear() - year;
  var m = now.getUTCMonth() + 1;
  if (m < month || (m === month && now.getUTCDate() < day)) age -= 1;
  return age < 0 ? null : age;
}

function icosiumReject(message: string): never {
  throw { message: message, code: INVALID_ARGUMENT };
}

function beforeAuthenticateEmail(
  _ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  data: nkruntime.AuthenticateEmailRequest,
): nkruntime.AuthenticateEmailRequest {
  if (!data.create) return data; // simple connexion à un compte existant
  var vars = (data.account && data.account.vars) || {};
  var birthdate = vars["birthdate"];
  if (!birthdate) return icosiumReject("invalid_birthdate");
  var age = icosiumAge(birthdate, new Date());
  if (age === null || age > 120) return icosiumReject("invalid_birthdate");
  if (age < ICOSIUM_MIN_AGE) return icosiumReject("too_young");
  return data;
}

function afterAuthenticateEmail(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  session: nkruntime.Session,
  request: nkruntime.AuthenticateEmailRequest,
): void {
  if (!session.created || !ctx.userId) return;
  var vars = (request.account && request.account.vars) || {};
  // Date de naissance privée : lisible et modifiable seulement par le serveur.
  nk.storageWrite([
    {
      collection: "private",
      key: "birthdate",
      userId: ctx.userId,
      value: { birthdate: vars["birthdate"] || "" },
      permissionRead: 0,
      permissionWrite: 0,
    },
  ]);
  logger.info("New email account created: %s", ctx.userId);
}

function beforeAuthenticateDevice(
  _ctx: nkruntime.Context,
  _logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  data: nkruntime.AuthenticateDeviceRequest,
): nkruntime.AuthenticateDeviceRequest {
  var vars = (data.account && data.account.vars) || {};
  if (vars["age_confirmed"] !== "true") return icosiumReject("age_not_confirmed");
  return data;
}

function InitModule(
  _ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  _nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer,
): void {
  initializer.registerBeforeAuthenticateEmail(beforeAuthenticateEmail);
  initializer.registerAfterAuthenticateEmail(afterAuthenticateEmail);
  initializer.registerBeforeAuthenticateDevice(beforeAuthenticateDevice);
  logger.info("ICOSIUM module loaded (min age %d)", ICOSIUM_MIN_AGE);
}

