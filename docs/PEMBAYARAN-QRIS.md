# Pembayaran QRIS dengan Verifikasi Otomatis (Midtrans)

Setiap tagihan klien dibayar lewat **QRIS** yang bisa dipindai dari aplikasi apa pun
(DANA, GoPay, OVO, ShopeePay, m-banking). QR tampil langsung di halaman galeri (bukan popup).

| | **QRIS Midtrans** (utama) | **QR DANA Bisnis** (cadangan otomatis) |
|---|---|---|
| QR | QRIS resmi diterbitkan Midtrans per transaksi | Dibentuk dari QR statis DANA Bisnis Anda |
| Verifikasi | **Otomatis** (HTTP Notification, signature SHA-512) | Admin, 1 klik di Daftar Pesanan |
| Nominal | Pas sesuai tagihan | Tagihan + kode unik Rp1–999 |
| Perlu HP khusus | Tidak | Tidak |
| Dana masuk ke | Saldo Midtrans → dicairkan ke rekening | Langsung ke DANA Bisnis |
| Biaya | MDR QRIS sesuai ketentuan Midtrans/BI | Sesuai ketentuan DANA |

Bila `MIDTRANS_SERVER_KEY` diatur, QRIS Midtrans dipakai. **Bila Midtrans menolak** (mis. akun
masih ditinjau atau QRIS belum aktif) atau belum diatur, sistem **otomatis** memakai QR DANA Bisnis
yang diunggah di Pengaturan — klien tetap bisa membayar.

## Alur (QRIS Midtrans)
```
Klien klik "Konfirmasi" → server menghitung tagihan (mis. Rp 350.000)
  → POST Midtrans /v2/charge {payment_type: "qris", acquirer gopay} → qr_string + expire_time
  → galeri menampilkan QR bernominal pas (berlaku 30 menit) + "Simpan gambar QR"
Klien membayar → Midtrans mengirim HTTP Notification ke /api/webhook/midtrans
  → server memverifikasi signature_key = SHA512(order_id + status_code + gross_amount + ServerKey)
  → status "settlement" → proyek LUNAS → galeri terbuka otomatis
  (cadangan: galeri meminta server mengecek GET /v2/{order_id}/status tiap ±5 detik)
```

## Langkah pemasangan
1. **Daftar/aktifkan akun Midtrans** (midtrans.com). Menurut Midtrans, akun perorangan cukup **KTP**
   untuk mengaktifkan **QRIS, GoPay, dan transfer bank** (NPWP diperlukan untuk metode lain).
   Selesaikan onboarding sampai QRIS/GoPay aktif.
2. **Uji di Sandbox dulu:** Dashboard Midtrans (mode Sandbox) → *Settings → Access Keys*. Isi di Vercel:

   | Variabel | Isi |
   |---|---|
   | `MIDTRANS_SERVER_KEY` | Server Key (rahasia), sandbox diawali `SB-Mid-server-` |
   | `MIDTRANS_CLIENT_KEY` | Client Key (untuk Snap/metode lain) |
   | `MIDTRANS_IS_PRODUCTION` | `false` saat sandbox, `true` saat produksi (bila kosong dideteksi dari awalan kunci) |
   | `MIDTRANS_QRIS_ACQUIRER` | (opsional) `gopay` (bawaan) atau `airpay shopee` |
   | `MIDTRANS_QRIS_ENABLED` | (opsional) isi `false` untuk menonaktifkan QRIS Midtrans dan memakai QR DANA saja |

3. **Payment Notification URL:** Dashboard Midtrans → *Settings → Configuration* →
   `https://<domain-anda>/api/webhook/midtrans`
4. **Redeploy**, lalu buka **Pengaturan → Metode Pembayaran**: status harus
   **"✓ Verifikasi otomatis aktif (QRIS Midtrans)"**.
5. Bayar uji di sandbox memakai *QRIS simulator* Midtrans, pastikan galeri terbuka sendiri.
6. **Produksi:** ganti ke kunci produksi, `MIDTRANS_IS_PRODUCTION=true`, ubah Notification URL di
   dashboard produksi, redeploy, lalu uji sekali dengan nominal kecil.

## Keamanan
- Notifikasi ditolak bila `signature_key` tidak cocok dengan Server Key di server.
- Nominal transaksi dihitung server; proyek ditandai lunas secara transaksional & idempoten
  (notifikasi berulang tidak diproses dua kali).
- Server Key hanya disimpan sebagai variabel lingkungan server.

## Mode cadangan: QR DANA Bisnis
Unggah gambar QR DANA Bisnis di **Pengaturan → Metode Pembayaran → QRIS DANA Bisnis**. Dipakai
bila Midtrans belum diatur atau menolak transaksi. Klien membayar QR bernominal (tagihan + kode unik),
lalu menekan "Konfirmasi via WhatsApp". Admin mencocokkan nominal unik yang tampil di modal
verifikasi dengan dana masuk di aplikasi DANA Bisnis, lalu klik **Setujui (1-Klik)**.
