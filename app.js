const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require("express-session");
const bodyParser = require("body-parser");
const User = require( './models/user' );
const flash = require('connect-flash');
const Section = require('./models/section');
const async = require('async');
// const favicon = require('serve-favicon');
// var path = require('path');

var weekday = new Array(7);
weekday[0] = "Sunday";
weekday[1] = "Monday";
weekday[2] = "Tuesday";
weekday[3] = "Wednesday";
weekday[4] = "Thursday";
weekday[5] = "Friday";
weekday[6] = "Saturday";


//codes for authentication
// here we set up authentication with passport
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const passport = require('passport')
const configPassport = require('./config/passport')
configPassport(passport);

var app = express();
// app.use(favicon(path.join(__dirname,'public','images','favicon.ico')));

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var brandeisHomeRouter = require('./routes/BrandeisHome');
var brandeisClassScheduleRouter = require('./routes/BrandeisClassSchedule');
var brandeisClassSearchRouter = require('./routes/BrandeisClassSearch');
var addpostsRouter = require('./routes/addposts');
var postsController = require('./controllers/postsController');
var contactsController = require('./controllers/contactsController');
var teamRouter = require('./routes/team');
var footertermsRouter = require('./routes/footer-terms');
var api_controller = require('./controllers/api.js');
var brandeisMajorSearchRouter = require('./routes/BrandeisMajorSearch')
var Group = require('./models/group.js');
var Subject = require('./models/subject');
var Term = require('./models/term');
var Course = require('./models/course');


//Test whether the mongoose database can work
const mongoose = require( 'mongoose');
const mongoDB = process.env.MONGO_URI || "mongodb://localhost:27017/CollegeInfo";
mongoose.connect( mongoDB, {useNewUrlParser: true});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log("Mongoose Database Normal")
});


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
  secret: 'zzbbyanana',
  resave: false,
  saveUninitialized: true,
}));
app.use(flash());
app.use(express.static(path.join(__dirname, 'public')));

//new code for authentication
app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.urlencoded({ extended: false }));
//app.use(passport_google_check)

// here is where we check on their logged in status
app.use((req,res,next) => {
  res.locals.loggedIn = false
  if (req.isAuthenticated()){
    console.log("user has been Authenticated")
    res.locals.user = req.user
    res.locals.loggedIn = true;
  }
  next()
})

app.use(bodyParser.urlencoded({ extended: true}));

// here are the authentication routes

app.get('/loginerror', function(req,res){
  res.render('loginerror',{})
})

app.get('/login', function(req,res){
  res.render('login',{})
})

// route for logging out
app.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });

// =====================================
// GOOGLE ROUTES =======================
// =====================================
// send to google to do the authentication
// profile gets us their basic information including their name
// email gets their emails
app.get('/auth/google', passport.authenticate('google', { scope : ['profile', 'email'] }));

// the callback after google has authenticated the user
app.get('/auth/google/callback',
        passport.authenticate('google', {
                successRedirect : '/BrandeisHome',
                failureRedirect : '/loginerror'
        }));

app.get('/BrandeisHome/authorized',
        passport.authenticate('google', {
                successRedirect : '/BrandeisHome',
                failureRedirect : '/loginerror'
        }));
console.log("Authentication System Normal")

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {
  console.log("checking to see if they are authenticated!")
  // if user is authenticated in the session, carry on
  if (req.isAuthenticated()){
    console.log("user has been Authenticated")
    return next();
  }else{
    console.log("user has not been authenticated...")
    // if they aren't redirect them to the home page
    res.redirect('/login');
  }

}

// we require them to be logged in to see their profile
app.get('/BrandeisHome', isLoggedIn, function(req, res) {
    res.render('BrandeisHome', {
        user : req.user // get the user out of session and pass to template
    });
});

function replyToDiaf(req, res, next){
  // console.dir(req.body)
  return res.json({
      "fulfillmentMessages": [],
      "fulfillmentText": res.locals.output_string,
      "payload":{"slack":{"text":res.locals.output_string}},
      "outputContexts": [],
      "source": "Text Source",
      "followupEventInput":{}
    });

}


/*
 * This part is for the speaking control part.
 * The speaking control part provides a platform for user to search class database
 * by spekaing the keyword of the class, like name, time, instructor, etc. We use
 * DialogFlow to edit the intents and entities to train the system. The user need to
 * give a sentence first, like "I want to find a class offered by Computer Science Department
 * from 8 to 10 in the fall semester". The core information is "tiem-period", "department name",
 * and "term". If the user miss any piece of these information, the system will keep asking
 * until the user provide all core information.
 */

 // This function processes the request and return the right respond
function process_request(req, res, next){
  //console.dir(req.body.queryResult.parameters);
  res.locals.output_string = "there was an error";
  var temp = "";
  console.log("in the processing")
  sessions[req.body.session]= sessions[req.body.session] || {};
  console.dir(sessions);
  let session = sessions[req.body.session];
  console.dir(session);
  console.log("before user find one");
  //if getKeycode
  let keycode = 0;
  User.findOne({keycode: keycode}, function(err, user_doc){
    if(err){
      res.status(err.status || 500);
      res.json(err);
    } else {
      if(user_doc){
        session.user_id = user_doc._id;
      } else {
        session.user_id = 0;
      }
      keycode = session.user_id;
    }
  })

  //============================================================================

  console.log("before if");

  if(req.body.queryResult.intent.displayName == "how_many_total"){
    console.log("how many triggered");
    Section.count()
      .exec()
      .then((num) => {
        console.log("in next(num)" + num);
        res.locals.output_string = "There are " + num + " courses";
        session.department = "all";
        next();
      })
      .catch((err) => {
        console.log("err");
        console.dir(err);
        res.locals.output_string = "There was an error.";
        next();
      })
  }else if(req.body.queryResult.intent.displayName == "which_classes_at_time"){
    console.log("which classes at time triggered");
    console.dir(req.body);
    const date = req.body.queryResult.parameters['date'];
    console.log("date = " + date);
    var d = new Date(date);
    console.dir(d);
    let factor = "";

    if (d.getDay()==2 || d.getDay()==4){
      factor = weekday[d.getDay()].substring(0,2).toLowerCase();
    }else{
      factor = weekday[d.getDay()].substring(0,1).toLowerCase();
    }
    const current_date = new Date();
    var term = req.body.queryResult.parameters.Term;


    function dateToNumber(date){
      let convertedTime = date.getMinutes() + date.getHours()*60;
      return convertedTime;
    }

    function numberToString(minutes){
      let convertedTimeString;
      if (minutes % 60 ==0){
        convertedTimeString = minutes/60 + ":00";
      }else{
        convertedTimeString = minutes/60 + ":" + "minutes%60";
      }
      return convertedTimeString;
    }

    //get term

    //term --> get section
    var current_term_code = "";
    var course_id_list = [];
    var sub_id = "";
    var course_list_result = "";
    var converted_Time_String_Start = "";
    var converted_Time_String_End = "";
    async.series([
      function(callback){
        if(!term){
          Term.findOne({start: {$lte: current_date}, end: {$gte: current_date}}, function(err, term_doc){
            console.log("term_doc: "+term_doc)
            if(err){
              console.log(err);
              callback(err, null);
            } else if(term_doc.name.includes("Summer")){
              //change the term to the next one
              current_term_code = term_doc.id.substring(0, 3) + (parseInt(term_doc.id.substring(3)) + 1);
              callback(null, null);
            } else {
              current_term_code = term_doc.id;
              callback(null, null);
            }
          })
        } else {
          callback(null, null);
        }
      },
      function(callback){
        const section_id_regex = new RegExp("^" + current_term_code + "-");

        const section_query = {
          "times.days":factor,
          id: {$regex: section_id_regex},
        };

        if(req.body.queryResult.parameters["time-period"]){
          console.log("We're in time period function!")
          let time_period = req.body.queryResult.parameters["time-period"];
          let startTime = dateToNumber(new Date(time_period.startTime));
          let endTime = dateToNumber(new Date(time_period.endTime));
          if (startTime <480 && endTime <480){
            startTime +=720;
            endTime += 720;
            console.log("startTime: "+startTime);
          }else if (startTime >=1290 && endTime>1290){
            startTime -= 720;
            endTime -=720;
          }

          converted_Time_String_Start = numberToString(new Number(startTime));
          converted_Time_String_End = numberToString(new Number(endTime));
          console.log(converted_Time_String_Start);
          console.log(converted_Time_String_End);

          section_query["times.end"] = {$lte: endTime};
          section_query["times.start"] = {$gte: startTime};
        }

        if(req.body.queryResult.parameters["Subject"]){
          console.log("We're in the subject function")
          //console.log("subject: "+req.body.queryResult.parameters["Subject"])
          var sub_name = req.body.queryResult.parameters["Subject"];
          Subject.findOne({name: sub_name}, 'id', function(err, subject_id){
            if(err){
              console.log(err);
            }else if(subject_id){
              sub_id = subject_id;
              console.log("subject id: " + sub_id);
            }
          })
        }

        Section.distinct('course', section_query, function(err, id_list){
          if(err){
            callback(err, null);
          } else {
            course_id_list = id_list;
            callback(null, null);
          }
        })
      },
      function(callback){
        //console.log("course_id_list"+course_id_list);
        //console.log("subject_id: " + sub_id.id)
        const sub_regex = new RegExp(sub_id.id.substring(sub_id.id.indexOf("-") + 1) + "$");
        Course.find({id: {$in: course_id_list}, "subjects.id": {$regex: sub_regex}}, function(err, course_list){
          if(err){
            callback(err, null);
          }else{
            course_list_result = course_list;
            callback(null, null);
            //console.log(course_list_result);
          }

        })
      },
      function(callback){
        Course.find({id: {$in: id_list}, "subject.id": sub_id}, function(err, course_list){
          console.log(course_list);

          callback(null, course_list);

        })
      }
    ], function(err, results){
      if(err){
        console.log(err);
        res.locals.output_string = "Something went wrong...";
      } else {
        console.log(course_list_result);
        let time_period = req.body.queryResult.parameters["time-period"];

        res.locals.output_string = "We have found " + course_list_result.length + " classes offered by " + req.body.queryResult.parameters["Subject"]+ " Department" +" on "+weekday[d.getDay()] +
        " from " + converted_Time_String_Start + ":" + " to " + converted_Time_String_End +
        " for you! ";
      }
      next();
    })
  } else if (req.body.queryResult.intent.displayName == "who_designed") {
    res.locals.output_string = "Jierui Peng, Jialin Zhou, and Xuxin Zhang";
    next();
  } else if(req.body.queryResult.intent.displayName == "help"){
    res.locals.output_string = "You can say something like \"Which classes are offered by Computer Science Department from 8 to 11 am on Wednesday?\" ";
  } else {
    res.locals.output_string = "Oops, something went wrong... Could you please rephrase your request? You can say \"help\" for detailed support";
  }
}



  //get term

  //term --> get section

  //start & end time --> get section

  //section --> get course

  //subject --> get course











let sessions = {};

app.post('/hook', process_request, replyToDiaf);

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/BrandeisHome', isLoggedIn, brandeisHomeRouter);
app.use('/BrandeisClassSchedule', isLoggedIn, brandeisClassScheduleRouter)
app.post('/add_section_to_schedule', isLoggedIn, api_controller.add_section_to_schedule)
app.use('/BrandeisClassSearch', isLoggedIn, brandeisClassSearchRouter)
app.post('/get_section_data', isLoggedIn, api_controller.get_section_data_post);
app.post('/delete_section_data', isLoggedIn, api_controller.delete_section_data);
app.use('/team', teamRouter)
app.use('/footer-terms', footertermsRouter)
app.use('/BrandeisMajorSearch', isLoggedIn, brandeisMajorSearchRouter)

app.get('/addposts', isLoggedIn,function(req,res){
 console.log("adding posts")
 res.render('addposts',{})
});
app.post('/addposts', isLoggedIn, postsController.savePosts)
app.get('/posts', isLoggedIn, postsController.getAllPosts );
app.post('/posts', isLoggedIn, postsController.filterPosts);
app.get('/posts/:id', isLoggedIn, postsController.attachPdes, postsController.getPdes);
app.get('/myposts', isLoggedIn, postsController.myPosts);
app.post('/myposts/:post_id/delete', isLoggedIn, postsController.deletePost);

app.get('/chatroom', isLoggedIn, function(req, res){
  res.render('chatroom', {})
});

app.get('/Groups', isLoggedIn, function(req, res){
  Group.find({}, function(err, group_list){
    if(err){
      res.status(err.status || 500);
      res.json(err);
    } else {
      res.render("Groups", {
        title: "groups",
        Groups: group_list,
      });
    }
  })
});

app.get('/Groups/addGroups', isLoggedIn, function(req, res){
  res.render('addGroups');
})

app.post('/Groups/addGroups', isLoggedIn, function(req, res){
  const group_name = req.body.name.trim();
  if(!group_name){
    res.status(400);
    res.json({message: "Please enter a name for the group"})
    return;
  } else if(typeof group_name != "string"){
    res.status(400);
    res.json({message: "Please enter a valid group name"});
    return;
  }

  const group = {
    name: req.body.name,
    createdAt: new Date(),
    locked: false,
  }

  const new_group = new Group(group);
  new_group.save(function(err){
    if(err){
      res.status(err.status || 500);
      res.json(err);
    } else {
      res.redirect('/Groups');
    }
  })
})

//add grous for each subject
if(process.env.GENERATE_GROUP == "true"){
  const group_list = [];
  Subject.distinct('name',{}, function(err, result){
    for(var subject_name of result){
      const group = {
        name: "Discussion group for " + subject_name,
        createdAt: new Date(),
        locked: true,
      }

      const new_group = new Group(group);
      group_list.push(new_group);

      var sorted_group_list = group_list.sort(function(a,b){
        return new Date(Date.parse(a.CreatedAt)) - new Date(Date.parse(b.CreatedAt));
    });
    }

    Group.insertMany(sorted_group_list, function(err, group_list){
      if(err){
        console.log(err);
      } else {
        console.log("Subject groups successfully generated.")
      }
    })
  })
}


app.post('/Groups/delete/:id', isLoggedIn, function(req, res){
  Group.findByIdAndRemove(req.params.id, function(err){
    if(err){
      res.status(err.status || 500);
      res.json(err);
    } else {
      res.json({});
    }
  })
})

//////////////
//change later
app.get('/profile', isLoggedIn, function(req, res){
  res.render('profile', {user:req.user})
})

app.post('/update_keycode', isLoggedIn, function(req, res){
  const keycode = req.body.keycode;

  User.findOne({keycode: keycode}, function(err, doc){
    if(err){
      res.status(err.status || 500);
      res.json(err);
    } else {
      if(doc){
        if(doc._id.toString() == req.user._id.toString()){
          res.json({});
        } else {
          res.status(400);
          res.json({message: "Keycode used."});
        }
      } else {
        User.findById(req.user._id, function(err, user_doc){
          if(err){
            res.status(err.status || 500);
            res.json(err);
          } else {
            user_doc.keycode = keycode;
            user_doc.save(function(err){
              if(err){
                res.status(err.status || 500);
                res.json(err);
              } else {
                res.json({});
              }
            })
          }
        })
      }
    }
  })


})

//////////////

//For contact us page
app.get('/contacts', function(req,res){
  console.log("adding contacts")
  res.render('contacts',{})
 });
// app.get('/contacts', contactsController.savePosts)

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});


// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
console.log("System Normal")
