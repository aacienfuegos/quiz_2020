const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const {models} = require("../models");

const paginate = require('../helpers/paginate').paginate;

// Autoload el group asociado a :groupId
exports.load = async (req, res, next, groupId) => {

    try {
        const group = await models.Group.findByPk(groupId);
        if (group) {
            req.load = {...req.load, group};
            next();
        } else {
            throw new Error('There is no group with id=' + groupId);
        }
    } catch (error) {
        next(error);
    }
};

// GET /groups
exports.index = async (req, res, next) => {

    try {
        const groups = await models.Group.findAll();
        res.render('groups/index.ejs', {groups});
    } catch (error) {
        next(error);
    }
};


// GET /groups/new
exports.new = (req, res, next) => {

    const group = { name: ""};
    res.render('groups/new', {group});
};

// POST /groups/create
exports.create = async (req, res, next) => {

    const {name} = req.body;

    let group = models.Group.build({name});

    try {
        // Saves only the field name into the DDBB
        group = await group.save({fields: ["name"]});
        req.flash('success', 'Group created successfully.');
        res.redirect('/groups/' + group.id);
    } catch (error) {
        if (error instanceof Sequelize.ValidationError) {
            req.flash('error', 'There are errors in the form:');
            error.errors.forEach(({message}) => req.flash('error', message));
            res.render('groups/new', {group});
        } else {
            req.flash('error', 'Error creating a new group: ' + error.message);
            next(error);
        }
    }
};


// GET /groups/:groupId/edit
exports.edit = async (req, res, next) => {
	const {group} = req.load;
	const allQuizzes = await models.Quiz.findAll();
	const groupQuizzesIds = await group.getQuizzes().map(quiz => quiz.id);
	res.render('groups/edit', {group, allQuizzes, groupQuizzesIds});
};


// PUT /groups/:groupId
exports.update = async (req, res, next) => {

    const {group} = req.load;

	const {name, quizzesIds = []} = req.body;
	group.name = name.trim();

    try {
        await group.save({fields: ["name"]});
		await group.setQuizzes(quizzesIds);
        req.flash('success', 'group edited successfully.');
        res.redirect('/groups');
    } catch (error) {
        if (error instanceof Sequelize.ValidationError) {
            req.flash('error', 'There are errors in the form:');
            error.errors.forEach(({message}) => req.flash('error', message));
            res.render('groups/edit', {group});
        } else {
            req.flash('error', 'Error editing the group: ' + error.message);
            next(error);
        }
    }
};


// DELETE /groups/:groupId
exports.destroy = async (req, res, next) => {

    try {
        await req.load.group.destroy();
        req.flash('success', 'group deleted successfully.');
        res.redirect('/goback');
    } catch (error) {
        req.flash('error', 'Error deleting the group: ' + error.message);
        next(error);
    }
};


// GET /quizzes/randomPlay
exports.randomPlay = async (req, res, next) => {
		req.session.randomPlay = req.session.randomPlay || {
			resolved: [],
			lastQuizId: 0
		};

		let quiz;

		if(req.session.randomPlay.lastQuizId){
			quiz = await models.Quiz.findByPk(req.session.randomPlayLastQuiz);
		} else {
			const total = await models.Quiz.count();
			const quedan = total - req.session.randomPlay.resolved.length;

			quiz = await models.Quiz.findOne({
			where: {'id': {[Sequelize.Op.notIn]: req.session.randomPlay.resolved}},
			offset: Math.floor(Math.random() * quedan)
			});
		}

		const score = req.session.randomPlay.resolved.length;

		if(quiz){
			req.session.randomPlay.lastQuizId = quiz.id;
			res.render('groups/random_play', {quiz, score});
		}else {
			delete req.session.randomPlay;
			res.render('groups/random_nomore', {score});
		}
};

// GET /quizzes/randomCheck
exports.randomCheck = (req, res, next) => {
		req.session.randomPlay = req.session.randomPlay || {
			resolved: [],
			lastQuizId: 0
		};

        const answer = req.query.answer || "";
        const result = answer.toLowerCase().trim() === req.load.quiz.answer.toLowerCase().trim();

		let score = req.session.randomPlay.resolved.length;

		if(result){
			req.session.randomPlay.lastQuizId = 0;
			req.session.randomPlay.resolved.push(req.load.quiz.id);

			score = req.session.randomPlay.resolved.length;

			res.render('groups/random_result', {result, answer, score});
		} else {
			delete req.session.randomPlay;
			res.render('groups/random_result', {result, answer, score});
		}


};
