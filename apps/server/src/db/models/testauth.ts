import axios from 'axios'

async function testAuth() {
  try {
    // 1️⃣ Login
    const loginResp = await axios.post('http://localhost:4000/auth/login', {
      username: 'testuser' ,//'ritvik' 
      password: 'test123'  // 'ritvik123'
    })

    const { accessToken, refreshToken } = loginResp.data
    console.log('Access Token:', accessToken)
    console.log('Refresh Token:', refreshToken)

    // 2️⃣ Call protected route
    const protectedResp = await axios.get('http://localhost:4000/protected', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })

    console.log('Protected route response:', protectedResp.data)

  } catch (err: any) {
    console.error('Error:', err.response?.status, err.response?.data || err.message)
  }
}

testAuth()
