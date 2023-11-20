const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;


app.use(cors());
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tydoizp.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const menuCollections = client.db('bistroDb').collection('menu');
    const reviewCollections = client.db('bistroDb').collection('reviews');
    const cartCollections = client.db('bistroDb').collection('carts');
    const userCollections = client.db('bistroDb').collection('users');
    const paymentCollections = client.db('bistroDb').collection('payments');


    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorize access' })
      }
      const token = req.headers.authorization.split(' ')[1]
      if (!token) {
        return res.status(401).send({ message: 'unauthorize access' })
      }
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: 'forbidden access' })
        } else {
          req.decoded = decoded;
          next();
        }
      })
    }

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollections.findOne(query);
      const isAdmin = user?.role === 'admin' ? true : false;
      next();
    }


    app.get('/menu', async (req, res) => {
      const result = await menuCollections.find().toArray();
      res.send(result)
    })

    app.get('/menu/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollections.findOne(query);
      res.send(result);
    })

    app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      const result = await menuCollections.insertOne(item);
      res.send(result)
    })

    app.patch('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const update = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe
        }
      };
      const result = await menuCollections.updateOne(filter, update);
      res.send(result);
    })

    app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollections.deleteOne(query);
      res.send(result)
    })

    app.get('/reviews', async (req, res) => {
      const result = await reviewCollections.find().toArray();
      res.send(result)
    })

    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollections.find(query).toArray();
      res.send(result)
    })

    app.get('/users', verifyToken, async (req, res) => {

      const result = await userCollections.find().toArray();
      res.send(result)
    })

    app.get('/users/admin/:email', verifyToken, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" })
      }
      const query = { email: email };
      const user = await userCollections.findOne(query);

      const isAdmin = (user?.role === 'admin' ? true : false);
      res.send({ isAdmin })
    })

    app.post('/users', verifyToken, verifyAdmin, async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existing = await userCollections.findOne(query);
      if (existing) {
        return res.send({ message: 'user already existing', insertedId: null });
      }
      const result = await userCollections.insertOne(user);
      res.send(result);
    })

    app.patch('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const update = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollections.updateOne(filter, update);
      res.send(result)
    })

    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollections.deleteOne(query);
      res.send(result)
    })

    app.post('/carts', async (req, res) => {
      const food = req.body;
      const result = await cartCollections.insertOne(food);
      res.send(result)
    })

    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollections.deleteOne(query);
      res.send(result);
    })

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: 60 * 60 })
      res.send({ token })
    })

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card']
      });
      console.log(paymentIntent.client_secret)
      res.send({
        clientSecrete: paymentIntent.client_secret
      })
    })

    app.get('/payments/:email', verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const result = await paymentCollections.find(query).toArray();
      res.send(result)
    })

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollections.insertOne(payment);

      const query = {
        _id: {
          $in: payment.cartIds.map(id => new ObjectId(id))
        }
      }
      const deleteResult = await cartCollections.deleteMany(query);

      res.send({ paymentResult, deleteResult })

    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('restaurant is running');
})

app.listen(port, () => {
  console.log(`restaurant in running on PORT: ${port}`)
})
