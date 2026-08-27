export type Language = 'id' | 'en';

export const translations = {
  id: {
    // Header & Meta
    photosUploaded: (count: number) => `${count} Foto Terupload di GDrive`,
    photosCountLabel: (count: number) => `${count} foto`,
    exclusiveSelection: 'Pemilihan Foto Eksklusif',
    extraPrices: 'Harga Tambahan',
    requestEditor: 'Request Editor',
    switchLangBtn: '🇬🇧 EN',
    switchLangTitle: 'Switch to English',

    // Reopen & Previously Selected Photo Badges
    reopenedBannerTitle: 'Sesi Pemilihan Dibuka Kembali',
    reopenedBannerDesc: (prevCount: number, remaining: number, total: number) =>
      `Anda telah memilih/mengunduh ${prevCount} foto sebelumnya. Silakan pilih ${remaining} foto lagi untuk melengkapi kuota ${total} foto Anda.`,
    previouslySelectedBadge: '✓ Sudah Dipilih / Diunduh',
    newSelectionBadge: '+ Foto Baru',
    quotaRemainingInfo: (prev: number, remaining: number) => `${prev} foto dipilih sebelumnya • Sisa kuota: ${remaining} foto`,

    // Screenshot alert
    screenshotTitle: 'Tangkapan Layar Diblokir',
    screenshotDesc: 'Demi melindungi hak cipta fotografer, tindakan tangkapan layar (screenshot) tidak diizinkan pada galeri ini.',

    // Over limit & hints
    overLimitText: (extra: number, limit: number) => `Anda memilih ${extra} foto ekstra dari batas paket link (${limit} foto).`,
    extraCostText: (cost: string) => `Tambahan: Rp ${cost}`,
    hintTip: '💡 Ketuk 1x untuk memilih. Tekan lama pada foto untuk melihat ukuran penuh.',

    // Empty & Loading states
    noPhotosTitle: 'Belum ada foto',
    noPhotosDesc: 'Fotografer belum mengunggah foto ke galeri Anda.',
    notFound: 'Project tidak ditemukan.',

    // Bottom Pill Action Bar
    selected: 'Terpilih',
    totalGDrive: 'Total GDrive',
    photosCountShort: (count: number) => `${count} Foto`,
    bill: 'Tagihan',
    confirm: 'Konfirmasi',

    // Success Screen
    thankYou: (name: string) => `Terima Kasih, ${name}!`,
    successDesc: (count: number) => `Pembayaran berhasil dan ${count} foto Anda telah dikonfirmasi. Klik tombol di bawah untuk menyimpan foto Anda ke Google Drive.`,
    exportingNotice: 'Harap bersabar saat proses menyiapkan folder Google Drive Anda...',
    exportingQuote: '"Orang sabar disayang Tuhan" 😇',
    driveCreatedTitle: 'Folder Drive Berhasil Dibuat!',
    driveCreatedDesc: 'Foto-foto Anda sekarang tersimpan di folder Google Drive baru. Anda bisa membukanya dan menyimpannya ke akun Google Anda.',
    openDriveFolder: 'Buka Folder Drive Saya',
    preparingDrive: 'Menyiapkan Drive Anda...',
    downloadDriveBtn: 'Unduh Foto Pilihan Saya via Google Drive ⭐',
    driveHelpText: 'Kami akan membuatkan folder Drive khusus berisi foto pilihan Anda secara langsung.',
    reselectPhotosBtn: '✏️ Ubah / Pilih Ulang Foto',

    // Invoice Modal
    invoiceTitle: 'Foto Tambahan',
    invoiceDesc: 'Anda telah memilih lebih banyak foto dari batas paket Anda. Silakan selesaikan pembayaran untuk foto-foto tambahan.',
    includedLimit: 'Batas Paket Termasuk',
    totalSelected: 'Total Terpilih',
    packageLabel: (name: string) => `Paket: ${name}`,
    extraPhotosLabel: (count: number, price: string) => `Foto Tambahan (${count} x Rp ${price})`,
    alreadyPaid: 'Sudah Dibayar',
    dpAmountLabel: 'Telah Dibayar (DP / Uang Muka)',
    remainingBill: 'Sisa Tagihan',
    midtransReviewNoticeTitle: 'Metode Utama: Transfer Manual Active',
    awaitingAdminTitle: 'Menunggu Konfirmasi Admin',
    awaitingAdminDesc: 'Bukti transfer Anda telah dikirim. Halaman ini akan diperbarui otomatis setelah admin memverifikasi.',
    proofInvalidTitle: 'Bukti Belum Valid',
    proofInvalidDesc: 'Admin belum menerima bukti pembayaran yang sesuai. Silakan hubungi admin via WhatsApp.',
    contactAdminWa: 'Hubungi Ulang Admin via WA',
    manualTransferTitle: 'Transfer Manual / E-Wallet',
    manualTransferDesc: 'Transfer ke rekening studio & konfirmasi via WA',
    primaryActiveTag: 'Utama (Aktif)',
    bankOrEwallet: 'Bank / E-Wallet',
    accountName: 'Atas Nama',
    accountNumber: 'Nomor Rekening',
    copyNo: 'Salin No.',
    copied: '✓ Tersalin!',
    confirmViaWa: 'Konfirmasi Transfer via WhatsApp',
    payViaMidtrans: 'Atau Bayar Otomatis via Midtrans (Snap)',
    autoVerificationNotice: 'Konfirmasi otomatis aktif. Setelah pembayaran berhasil, halaman ini akan langsung diperbarui secara otomatis tanpa perlu klik tombol apapun.',
    closeBtn: 'Tutup',
    simulatedSuccessBtn: '✓ Simulasi Berhasil',

    // Price List Modal
    officialPricelist: 'Daftar Harga Resmi',
    emptyPricelist: 'Belum ada daftar harga tambahan.',

    // Editor Request Modal
    editorModalTitle: 'Request Jasa Editor',
    editorModalDesc: 'Punya permintaan khusus untuk editan foto? Sampaikan ke tim editor kami di sini.',
    requestSuccessTitle: 'Request Berhasil Terkirim!',
    requestSuccessDesc: 'Tim kami akan segera memproses.',
    specialNotesLabel: 'Catatan Khusus (Opsional)',
    specialNotesPlaceholder: 'Contoh: Tolong hapus jerawat di wajah, ratakan warna kulit, dan buat lebih cerah.',
    cancelBtn: 'Batal',
    submitRequestBtn: 'Kirim Request',

    // SubToken Selector Modal
    selectNameTitle: 'Pilih Nama / Link Pemilihan Foto',
    selectNameDesc: (name: string) => `Paket foto untuk ${name} telah dibagi menjadi beberapa link:`,
    quotaText: (max: number) => `Kuota: ${max} foto`,
    selectThis: 'Pilih Ini →',
    viewMainGallery: (max: number) => `Lihat Galeri Utama (Total Kuota ${max} Foto)`,

    // Dynamic Alerts
    alertNoPhotosToDownload: 'Tidak ada foto yang terpilih untuk diunduh.',
    alertZipFailed: (err: string) => `Gagal mengunduh foto: ${err}`,
    alertExportFailed: (err: string) => `Gagal mengekspor foto ke Drive: ${err}`,
    alertNoWaNumber: 'Nomor WhatsApp admin belum dikonfigurasi di sistem. Silakan hubungi fotografer Anda secara manual.',
    alertSnapNotReady: 'Sistem pembayaran belum siap. Silakan refresh halaman.',
    alertSnapLoadFailed: 'Gagal memuat modul pembayaran Midtrans.',
    alertPaymentFailed: 'Pembayaran gagal atau dibatalkan.',
    alertEditorSubmitFailed: 'Gagal mengirim request editor.',
    alertPaymentLoadFailed: (err: string) => `Gagal memuat pembayaran: ${err}`,
  },
  en: {
    // Header & Meta
    photosUploaded: (count: number) => `${count} Photos Uploaded on GDrive`,
    photosCountLabel: (count: number) => `${count} photos`,
    exclusiveSelection: 'Exclusive Photo Selection',
    extraPrices: 'Extra Prices',
    requestEditor: 'Request Retouch',
    switchLangBtn: '🇮🇩 ID',
    switchLangTitle: 'Ganti ke Bahasa Indonesia',

    // Reopen & Previously Selected Photo Badges
    reopenedBannerTitle: 'Selection Session Reopened',
    reopenedBannerDesc: (prevCount: number, remaining: number, total: number) =>
      `You previously selected/downloaded ${prevCount} photos. Please choose ${remaining} more photos to complete your ${total} photo package.`,
    previouslySelectedBadge: '✓ Selected / Downloaded',
    newSelectionBadge: '+ New Photo',
    quotaRemainingInfo: (prev: number, remaining: number) => `${prev} previous photos • Remaining quota: ${remaining} photos`,

    // Screenshot alert
    screenshotTitle: 'Screenshot Blocked',
    screenshotDesc: 'To protect photographer copyright, taking screenshots is not allowed on this gallery.',

    // Over limit & hints
    overLimitText: (extra: number, limit: number) => `You selected ${extra} extra photos beyond your package limit (${limit} photos).`,
    extraCostText: (cost: string) => `Additional: Rp ${cost}`,
    hintTip: '💡 Tap once to select. Long press photo to view in full size.',

    // Empty & Loading states
    noPhotosTitle: 'No photos yet',
    noPhotosDesc: 'The photographer has not uploaded photos to your gallery yet.',
    notFound: 'Project not found.',

    // Bottom Pill Action Bar
    selected: 'Selected',
    totalGDrive: 'Total GDrive',
    photosCountShort: (count: number) => `${count} Photos`,
    bill: 'Total Due',
    confirm: 'Confirm',

    // Success Screen
    thankYou: (name: string) => `Thank You, ${name}!`,
    successDesc: (count: number) => `Payment successful and ${count} of your photos have been confirmed. Click the button below to save your photos to Google Drive.`,
    exportingNotice: 'Please wait while we prepare your Google Drive folder...',
    exportingQuote: '"Patience is a virtue" 😇',
    driveCreatedTitle: 'Drive Folder Created Successfully!',
    driveCreatedDesc: 'Your photos are now saved in a new Google Drive folder. You can open and save them to your Google account.',
    openDriveFolder: 'Open My Drive Folder',
    preparingDrive: 'Preparing Your Drive...',
    downloadDriveBtn: 'Download My Selected Photos via Google Drive ⭐',
    driveHelpText: 'We will directly create a dedicated Drive folder containing your selected photos.',
    reselectPhotosBtn: '✏️ Change / Reselect Photos',

    // Invoice Modal
    invoiceTitle: 'Invoice Summary',
    invoiceDesc: 'You have selected more photos than your package limit. Please complete payment for the additional photos.',
    includedLimit: 'Included Package Limit',
    totalSelected: 'Total Selected',
    packageLabel: (name: string) => `Package: ${name}`,
    extraPhotosLabel: (count: number, price: string) => `Extra Photos (${count} x Rp ${price})`,
    alreadyPaid: 'Already Paid',
    dpAmountLabel: 'Already Paid (Down Payment / DP)',
    remainingBill: 'Remaining Balance',
    midtransReviewNoticeTitle: 'Primary Method: Manual Transfer Active',
    awaitingAdminTitle: 'Awaiting Admin Confirmation',
    awaitingAdminDesc: 'Your transfer proof has been sent. This page will update automatically once verified by admin.',
    proofInvalidTitle: 'Proof Not Valid Yet',
    proofInvalidDesc: 'Admin has not received valid payment proof. Please contact admin via WhatsApp.',
    contactAdminWa: 'Contact Admin via WA Again',
    manualTransferTitle: 'Manual Transfer / E-Wallet',
    manualTransferDesc: 'Transfer to studio bank account & confirm via WA',
    primaryActiveTag: 'Primary (Active)',
    bankOrEwallet: 'Bank / E-Wallet',
    accountName: 'Account Holder',
    accountNumber: 'Account Number',
    copyNo: 'Copy No.',
    copied: '✓ Copied!',
    confirmViaWa: 'Confirm Transfer via WhatsApp',
    payViaMidtrans: 'Or Pay Automatically via Midtrans (Snap)',
    autoVerificationNotice: 'Automatic confirmation active. Once payment is successful, this page will update automatically without clicking anything.',
    closeBtn: 'Close',
    simulatedSuccessBtn: '✓ Simulation Success',

    // Price List Modal
    officialPricelist: 'Official Price List',
    emptyPricelist: 'No additional price items available.',

    // Editor Request Modal
    editorModalTitle: 'Request Retouch Service',
    editorModalDesc: 'Have special retouching requests? Submit them to our editing team here.',
    requestSuccessTitle: 'Request Successfully Sent!',
    requestSuccessDesc: 'Our team will process it shortly.',
    specialNotesLabel: 'Special Notes (Optional)',
    specialNotesPlaceholder: 'Example: Please remove blemishes, smooth skin tone, and brighten the image.',
    cancelBtn: 'Cancel',
    submitRequestBtn: 'Submit Request',

    // SubToken Selector Modal
    selectNameTitle: 'Select Name / Photo Selection Link',
    selectNameDesc: (name: string) => `Photo package for ${name} is divided into multiple links:`,
    quotaText: (max: number) => `Quota: ${max} photos`,
    selectThis: 'Select This →',
    viewMainGallery: (max: number) => `View Main Gallery (Total Quota ${max} Photos)`,

    // Dynamic Alerts
    alertNoPhotosToDownload: 'No photos selected to download.',
    alertZipFailed: (err: string) => `Failed to download photos: ${err}`,
    alertExportFailed: (err: string) => `Failed to export photos to Drive: ${err}`,
    alertNoWaNumber: 'Admin WhatsApp number is not configured in the system. Please contact your photographer manually.',
    alertSnapNotReady: 'Payment system is not ready yet. Please refresh the page.',
    alertSnapLoadFailed: 'Failed to load Midtrans payment module.',
    alertPaymentFailed: 'Payment failed or cancelled.',
    alertEditorSubmitFailed: 'Failed to submit editor request.',
    alertPaymentLoadFailed: (err: string) => `Failed to load payment: ${err}`,
  }
};
