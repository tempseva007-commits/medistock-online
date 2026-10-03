# MediStock Online — સરળ deployment steps (ગુજરાતી)

આ buildમાં website, Neon API, Admin login અને Admin દ્વારા Memberના page rights ગોઠવવાની સુવિધા છે.

## A. ZIP ખોલો

1. `medistock-online-ready.zip` download કરીને computer પર Extract કરો.
2. Extract થયા પછી `medistock-online` folder દેખાશે.
3. તેની અંદર `db/setup.sql`, `api`, `lib`, `src`, `index.html`, `package.json` અને `README.md` હશે.
4. આ source filesમાં કોઈ password/Neon URL નથી. Secrets ફક્ત Vercelમાં નાખવાના છે.

## B. Neonમાં નવો setup/migration run કરો

1. Neon Consoleમાં sign in કરીને MediStock project ખોલો.
2. **SQL Editor → New query** ખોલો.
3. Extract કરેલા folderમાંથી `db/setup.sql` file text editorમાં ખોલો.
4. આખો SQL copy કરીને Neon SQL Editorમાં paste કરો અને **Run** દબાવો.
5. સફળ થયા પછી `app_users`, `app_settings` અને `issue_stock` function સહિત જરૂરી schema તૈયાર થશે. પહેલેથી બનેલી સમાન tables હશે તો script તેમને ફરી create નહીં કરે.

> જો SQL Editor error બતાવે, તો error textનો screenshot મોકલો; કોઈ connection string કે password screenshotમાં ન દેખાય તેની ખાતરી કરો.

## C. GitHubમાં નવા files મૂકો

તમારી હાલની GitHub repositoryમાં જૂની static appને આ નવી project filesથી બદલો:

1. GitHub Desktop વાપરો તો existing repository computerમાં **Clone** કરો.
2. Extract કરેલા `medistock-online` folderની અંદરના files/foldersને repositoryમાં copy કરો.
3. GitHub Desktopમાં changed files review કરીને **Commit to main** અને પછી **Push origin** કરો.
4. Vercel repository સાથે જોડાયેલું હોય તો નવું code push થયા પછી deployment શરૂ થશે.

જો આખો `medistock-online` folder repositoryની અંદર જ મૂકો, તો Vercel projectનું **Root Directory** `medistock-online` રાખો. સરળ વિકલ્પ: તેના અંદરના files repository rootમાં મૂકો.

## D. Vercel environment variables ઉમેરો

Vercel → MediStock project → **Settings → Environment Variables** ખોલો. નીચેના variables ઉમેરો:

| Name | Value શું નાખવું | જરૂરિયાત |
|---|---|---|
| `DATABASE_URL` | Neonમાંથી reset પછીની નવી **pooled connection string** | ફરજિયાત |
| `ADMIN_NAME` | Adminનું દેખાતું નામ, જેમ કે `Admin` | Optional |
| `ADMIN_USERNAME` | Adminનું login username; ખાલી રાખો તો `ADMIN_EMAIL`ના @ પહેલાંનો ભાગ વપરાશે | Optional |
| `ADMIN_EMAIL` | Bootstrap Adminનું profile email; loginમાં email સ્વીકારાશે નહીં | ફરજિયાત |
| `ADMIN_PASSWORD` | Adminનો મજબૂત password; ઓછામાં ઓછા 10 characters | ફરજિયાત |
| `SESSION_SECRET` | password managerથી બનાવેલો random, લાંબો secret; ઓછામાં ઓછા 32 characters | ફરજિયાત |

દરેક variable માટે **Production** પસંદ કરો. `DATABASE_URL`નું નામ બરાબર આવું જ રાખવું—`VITE_` આગળ ન ઉમેરશો. Valueમાં quote marks ઉમેરવાની જરૂર નથી. **કોઈપણ secret chat અથવા GitHubમાં ન મોકલશો.**

Variables ઉમેર્યા પછી **Save** કરો. Vercel ઘણીવાર નવી deployment શરૂ કરે છે; ન થાય તો **Deployments → Redeploy** કરો.

## E. Deployment ચકાસો અને login કરો

1. Vercelમાં નવી deploymentનું status **Ready** થાય ત્યાં સુધી રાહ જુઓ.
2. Website URL ખોલો.
3. Sign-inમાં `ADMIN_USERNAME` (અથવા તે ન હોય તો `ADMIN_EMAIL`માં @ પહેલાંનું નામ) અને `ADMIN_PASSWORD` વાપરો. Emailથી login થતું નથી.
4. Adminના Users & Rights pageમાં જઈ **Create Member** દબાવો.
5. Memberનું નામ, username, profile email અને password ભરો; email login માટે વપરાતું નથી. Pages checkboxesથી પસંદ કરીને save કરો.
6. Member usernameથી login કરીને ફક્ત મંજૂર કરેલા pages જ જોઈ શકે છે. API પણ permissions ચકાસે છે.

Database connection ચકાસવા websiteના URL પાછળ `/api/health` ખોલો. `database: connected` દેખાવું જોઈએ. આ endpointમાં password દેખાતો નથી. જો `500 FUNCTION_INVOCATION_FAILED` આવે, તો Vercel → **Deployments → latest deployment → Functions/Logs**માં `/api/health`નો error જુઓ; `DATABASE_URL`નું નામ અને Production scope ચકાસો.

## Forgot Password

- **Member:** પોતાનું username Adminને આપો. Admin Users & Rightsમાં Member edit કરીને નવો password સેટ કરે.
- **Admin:** Vercel Environment Variablesમાં `ADMIN_PASSWORD` બદલીને redeploy કરો.
- માત્ર usernameથી કોઈ accountનો password બદલવાની છૂટ નથી—username એકલું identity proof નથી.

## F. Excel / CSV data import કરો

1. જૂની appમાંથી લીધેલો Excel backup computerમાં રાખો.
2. નવી appમાં Admin તરીકે login કરીને **Import** દબાવો.
3. આખી `.xlsx` workbook અથવા એક tableની `.csv` file પસંદ કરો. CSVમાં પહેલી row column headings હોવી જોઈએ; ઉદાહરણ તરીકે `Product Master.csv`, `Stock Entry.csv`, `Stock Out.csv` અથવા `Patient Master.csv`. CSVમાં columnનું નામ `Content Name`, `Stock IN`, `Expiry Date`, `Patient Name` વગેરે રાખો જેથી app ઓળખી શકે.
4. એક CSV file એક જ table માટે હોય છે. અનેક tables માટે અલગ CSV filesને એક-એક કરીને import કરો. Importની confirmation વાંચીને આગળ વધો.
5. Import હાલના data સાથે merge કરે છે. એજ workbook/CSV વારંવાર import કરવાથી stock transactions duplicate થઈ શકે—પહેલાં backup લો.
6. Products, patients અને દરેક batchનું stock ચકાસો.

## જો હજુ databaseમાં rows ન દેખાય

1. Vercel → **Settings → Environment Variables**માં `DATABASE_URL` value reset પછીની નવી connection string છે તેની ખાતરી કરો.
2. Keyનું નામ ચોક્કસ `DATABASE_URL` છે તેની ખાતરી કરો.
3. SQL Editorમાં `db/setup.sql` સફળતાથી run થયું હતું તેની ખાતરી કરો.
4. Vercel → **Deployments → Functions/Logs**માં error જુઓ. Screenshot મોકલતા પહેલાં secrets અને patientની વિગતો ઢાંકી દો.
