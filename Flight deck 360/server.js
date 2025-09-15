// server.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');

const app = express();
const PORT = 5000;
const SECRET_KEY = 'flight-secret-key';

app.use(bodyParser.json());

// In-memory storage
let users = [];
let flights = [
  { id: 1, flightNumber: 'AI101', from: 'Delhi', to: 'Mumbai', departure: '2025-09-20T10:00', arrival: '2025-09-20T12:00', seats: 120, price: 5000 },
  { id: 2, flightNumber: 'SG202', from: 'Bangalore', to: 'Chennai', departure: '2025-09-21T14:00', arrival: '2025-09-21T15:30', seats: 80, price: 3000 },
  { id: 3, flightNumber: 'BA303', from: 'Kolkata', to: 'Hyderabad', departure: '2025-09-22T09:00', arrival: '2025-09-22T11:30', seats: 100, price: 4500 },
  { id: 4, flightNumber: 'AI404', from: 'Mumbai', to: 'Bangalore', departure: '2025-09-23T16:00', arrival: '2025-09-23T18:00', seats: 90, price: 4000 }
];
let bookings = [];

// JWT Middleware
function auth(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token required' });
  try {
    const payload = jwt.verify(token, SECRET_KEY);
    req.user = payload;
    next();
  } catch {
    return res.status(403).json({ message: 'Invalid token' });
  }
}

// Routes
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (users.find(u => u.email === email)) return res.status(409).json({ message: 'Email exists' });
  const hash = await bcrypt.hash(password, 10);
  const newUser = { id: users.length+1, name, email, passwordHash: hash };
  users.push(newUser);
  const token = jwt.sign({ id: newUser.id, email: newUser.email }, SECRET_KEY, { expiresIn: '2h' });
  res.json({ token });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ message: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '2h' });
  res.json({ token });
});

app.get('/api/flights', auth, (req, res) => {
  res.json(flights);
});

app.post('/api/bookings', auth, (req, res) => {
  const { flightId, passengers } = req.body;
  const flight = flights.find(f => f.id == flightId);
  if (!flight) return res.status(404).json({ message: 'Flight not found' });
  if (flight.seats < passengers) return res.status(400).json({ message: 'Not enough seats' });
  flight.seats -= passengers;
  const booking = { id: bookings.length+1, userId: req.user.id, flightId, passengers };
  bookings.push(booking);
  res.json({ message: 'Booked successfully', booking });
});

app.get('/api/my-bookings', auth, (req, res) => {
  const userBookings = bookings.filter(b => b.userId === req.user.id)
    .map(b => {
      const flight = flights.find(f => f.id === b.flightId);
      return { ...b, flight };
    });
  res.json(userBookings);
});

app.post('/api/bookings/:id/cancel', auth, (req, res) => {
  const bookingId = parseInt(req.params.id);
  const booking = bookings.find(b => b.id === bookingId && b.userId === req.user.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  const flight = flights.find(f => f.id === booking.flightId);
  flight.seats += booking.passengers;
  bookings = bookings.filter(b => b.id !== bookingId);
  res.json({ message: 'Booking cancelled' });
});

// Serve frontend
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Flight Ticket System</title>
  <style>
    body{font-family:sans-serif; margin:20px;} input,button{padding:5px;margin:5px;}
    .card{border:1px solid #ccc; padding:10px; margin:10px 0; border-radius:5px;}
  </style>
</head>
<body>
  <h1>Flight Ticket Management</h1>

  <h2>Register</h2>
  <input id="regName" placeholder="Name"><br>
  <input id="regEmail" placeholder="Email"><br>
  <input id="regPass" type="password" placeholder="Password"><br>
  <button onclick="register()">Register</button>

  <h2>Login</h2>
  <input id="loginEmail" placeholder="Email"><br>
  <input id="loginPass" type="password" placeholder="Password"><br>
  <button onclick="login()">Login</button>

  <h2>Flights</h2>
  <button onclick="getFlights()">Show Flights</button>
  <div id="flights"></div>

  <h2>My Bookings</h2>
  <button onclick="getBookings()">Show My Bookings</button>
  <div id="mybookings"></div>

  <script>
    let token = '';

    async function register(){
      const name=document.getElementById('regName').value;
      const email=document.getElementById('regEmail').value;
      const password=document.getElementById('regPass').value;
      const res=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,password})});
      const data=await res.json();
      if(res.ok){token=data.token; alert('Registered & logged in!');} else alert(data.message);
    }

    async function login(){
      const email=document.getElementById('loginEmail').value;
      const password=document.getElementById('loginPass').value;
      const res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
      const data=await res.json();
      if(res.ok){token=data.token; alert('Logged in!');} else alert(data.message);
    }

    async function getFlights(){
      const res=await fetch('/api/flights',{headers:{Authorization:'Bearer '+token}});
      if(!res.ok){alert('Unauthorized'); return;}
      const flights=await res.json();
      const container=document.getElementById('flights');
      container.innerHTML='';
      flights.forEach(f=>{
        const div=document.createElement('div'); div.className='card';
        div.innerHTML=\`
          <b>\${f.flightNumber}</b> \${f.from} → \${f.to}<br>
          Departure: \${new Date(f.departure).toLocaleString()}<br>
          Seats: \${f.seats} Price: ₹\${f.price}<br>
          <button onclick="book(\${f.id},1)">Book 1</button>
          <button onclick="book(\${f.id},2)">Book 2</button>
        \`;
        container.appendChild(div);
      });
    }

    async function book(flightId, passengers){
      const res=await fetch('/api/bookings',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({flightId,passengers})});
      const data=await res.json();
      alert(res.ok ? 'Booked!' : data.message);
    }

    async function getBookings(){
      const res=await fetch('/api/my-bookings',{headers:{Authorization:'Bearer '+token}});
      const data=await res.json();
      const container=document.getElementById('mybookings');
      container.innerHTML='';
      data.forEach(b=>{
        const div=document.createElement('div'); div.className='card';
        div.innerHTML=\`
          Flight: \${b.flight.flightNumber} \${b.flight.from} → \${b.flight.to}<br>
          Passengers: \${b.passengers}
          <button onclick="cancel(\${b.id})">Cancel</button>
        \`;
        container.appendChild(div);
      });
    }

    async function cancel(id){
      const res=await fetch('/api/bookings/'+id+'/cancel',{method:'POST',headers:{Authorization:'Bearer '+token}});
      const data=await res.json();
      alert(data.message);
          getBookings();
        }
      </script>
    </body>
    </html>
        `);
    });
    