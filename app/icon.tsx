import { ImageResponse } from 'next/og'

// Route segment config
export const runtime = 'edge'

// Image metadata
export const size = {
  width: 512,
  height: 512,
}
export const contentType = 'image/png'

// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      // ImageResponse JSX element
      <div
        style={{
          fontSize: 340,
          background: 'linear-gradient(to bottom, #6366f1, #4338ca)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          borderRadius: '20%',
          fontWeight: 800,
          fontFamily: 'sans-serif',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        }}
      >
        Z
      </div>
    ),
    // ImageResponse options
    {
      ...size,
    }
  )
}
