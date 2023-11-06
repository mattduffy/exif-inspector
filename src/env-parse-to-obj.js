import Dotenv from 'dotenv'

try {
  Dotenv.config({ path: './config/test.env', debug: true })
  const test = Dotenv.parse(new Buffer.from(process.env.TEST))
  console.log('process.env.test: %o', test)
} catch (e) {
  console.error('oops')
}
