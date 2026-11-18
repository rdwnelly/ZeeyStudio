# Penerapan Firestore Security Rules & Firebase Admin SDK

Sejak pembaruan ini:

- **Dasbor staf** (Owner/Admin) mengakses Firestore dari browser dengan sesi Firebase Auth
  yang membawa klaim peran (`role`, `accesses`). `firestore.rules` memeriksa klaim tersebut.
- **Galeri klien, webhook pembayaran, Google Drive, dan login** berjalan di API Route
  memakai **Firebase Admin SDK** (`lib/firebase-admin.ts`), sehingga tidak terikat rules.
- Pengunjung tanpa login **tidak bisa** membaca/menulis Firestore sama sekali.

## Matriks akses (ringkas)

| Koleksi | Owner | Admin | Tanpa login |
|---|---|---|---|
| `projects` | baca/tulis | baca; buat (akses *create*); ubah (*create/bookings/crm*); hapus (*bookings/crm*) | – |
| `admins` | baca/tulis | – | – |
| `pricelist` | baca/tulis | baca | – |
| `expenses` | baca/tulis | – (komisi dicatat server) | – |
| `editor_requests` | baca/tulis | akses *editor*: baca, ubah `status`/`editedDriveLink` | – (dibuat via API) |
| `audit_logs` | baca, tambah | tambah (role harus sesuai token) | – |
| `settings/*` | baca/tulis | – | – (info publik via API) |

## Langkah penerapan (ikuti urutannya)

### 1. Buat kunci Firebase Admin
Firebase Console → ⚙️ Project settings → **Service accounts** → **Generate new private key**.
Simpan berkas JSON-nya di tempat aman (jangan di-commit).

### 2. Atur variabel lingkungan di Vercel (Production & Preview)
Semua kunci rahasia **hanya** dibaca dari variabel lingkungan server — aplikasi tidak lagi
membacanya dari Firestore, dan dasbor tidak menyediakan kolom isian kunci.

| Variabel | Wajib | Isi |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | ✓ | Seluruh isi berkas JSON dari langkah 1 |
| `OWNER_EMAILS` | ✓ | Email login Owner, pisahkan dengan koma bila lebih dari satu |
| `MIDTRANS_SERVER_KEY` | ✓ (untuk QRIS otomatis) | Server Key dari dasbor Midtrans → Settings → Access Keys |
| `MIDTRANS_CLIENT_KEY` | ✓ (bila pakai Midtrans) | Client Key dari halaman yang sama |
| `MIDTRANS_MERCHANT_ID` | – | Merchant ID |
| `MIDTRANS_IS_PRODUCTION` | – | `true` / `false`; bila kosong dideteksi dari awalan kunci (`Mid-` = production, `SB-Mid-` = sandbox) |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | ✓ | Isi JSON service account Google Drive (atau pakai `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY`) |
| `MIDTRANS_QRIS_ACQUIRER` | – | Acquirer QRIS Midtrans: `gopay` (bawaan) atau `airpay shopee`; lihat `docs/PEMBAYARAN-QRIS.md` |
| `CASHIFY_WEBHOOK_SECRET` | – | Hanya bila memakai webhook Cashify (lama) |

**Memindahkan kunci lama dari Firestore:** bila sebelumnya kunci diisi lewat dasbor, nilainya masih ada di
Firebase Console → Firestore → `settings/payment` (`midtrans_server_key`, `midtrans_client_key`, …) dan
`settings/gdrive`. Salin ke variabel di atas, deploy, lalu buka **Pengaturan → Metode Pembayaran** dan klik
**Hapus kunci lama dari database**. Status setiap variabel (terpasang/belum) tampil di tab tersebut dan tab Google Drive.

### 3. Deploy kode aplikasi
Push ke branch yang di-deploy Vercel. Pada tahap ini rules lama masih berlaku, jadi aplikasi tetap berjalan.

### 4. Login sekali sebagai Owner dan setiap Admin
- Owner: server memberi klaim `role: owner` (hanya untuk email di `OWNER_EMAILS`).
- Admin: kata sandi lama otomatis dimigrasi ke hash PBKDF2 saat login pertama.

### 5. Terbitkan Security Rules
Pilih salah satu:
- **Console:** Firestore Database → **Rules** → tempel isi `firestore.rules` → **Publish**.
- **CLI:** `npx firebase-tools deploy --only firestore:rules` (proyek sudah diatur di `.firebaserc`).

### 6. Disarankan
- Authentication → Settings → *User actions*: matikan **Enable create (sign-up)** agar orang lain tidak bisa membuat akun email/password.
- Setelah variabel lingkungan terpasang, hapus kunci lama dari database (lihat langkah 2).

## Mengembalikan (rollback)
Di Console → Firestore → Rules → tab riwayat, pilih versi sebelumnya lalu **Publish**.

## Pengujian lokal dengan Firebase Emulator
```bash
# Jalankan emulator Firestore + Auth (butuh Java)
npx firebase-tools emulators:start --only firestore,auth

# Terminal lain: jalankan aplikasi yang tersambung ke emulator
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true OWNER_EMAILS=owner@studio.id npm run dev
```
`NEXT_PUBLIC_USE_FIREBASE_EMULATOR` jangan diatur di Vercel.

## Catatan
- Saat Owner mengubah atau menghapus admin, sesi admin itu otomatis dicabut (`/api/staff/revoke-admin`); token yang sedang aktif berakhir paling lama ±1 jam, lalu admin harus login ulang dan memperoleh hak akses terbaru.
