import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get('image');

    if (!image) {
      return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 });
    }

    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'ImgBB API Key not configured' }, { status: 500 });
    }

    // Forward the form data to ImgBB
    const imgbbFormData = new FormData();
    imgbbFormData.append('image', image);

    const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: imgbbFormData as any,
    });

    const data = await imgbbRes.json();

    if (data.success) {
      return NextResponse.json({ success: true, url: data.data.url });
    } else {
      console.error('ImgBB error:', data);
      return NextResponse.json({ success: false, error: data.error?.message || 'Failed to upload' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Upload proof error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
