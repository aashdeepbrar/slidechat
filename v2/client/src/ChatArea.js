import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Button, TextField } from '@material-ui/core';
import markdownIt from 'markdown-it';
import markdownItMathJax from 'markdown-it-mathjax';
import highlight from 'highlight.js';

import { serverURL } from './config';
import { formatTime, formatNames, getDisplayName } from './util';

const md = markdownIt({
	breaks: true,
	highlight: function (str, lang) {
		if (lang && highlight.getLanguage(lang)) {
			try {
				return highlight.highlight(lang, str).value;
			} catch (err) {
				console.error(err);
			}
		}
		return '';
	},
});
md.use(markdownItMathJax());

/**
 * Sort the given question list
 * @param {*} unsorted question list
 * @param {String} sorting sorting method (update/create)
 * @returns the sorted question list
 */
function sortQuestions(unsorted, sorting) {
	let questions = unsorted.filter((a) => a != null);
	if (sorting === 'update') {
		return questions.sort((a, b) => b.time - a.time);
	} else if (sorting === 'create') {
		return questions.sort((a, b) => b.create - a.create);
	}
}

/**
 * This is the chat area on the right of the page.
 */
export default function ChatArea(props) {
	const [state, setState] = useState('list');
	const [questions, setQuestions] = useState([]);
	const [chatDetails, setChatDetails] = useState([]);
	const [qid, setQid] = useState(-1);
	const [questionTitle, setQuestionTitle] = useState('');
	const [managing, setManaging] = useState(false);
	const [drawing, setDrawing] = useState(false);
	const [sorting, setSorting] = useState('update');
	const titleRef = useRef(null);
	const bodyRef = useRef(null);
	const chatRef = useRef(null);

	// when first mounting, if the URL contains questions number, go to the question
	useEffect(() => {
		if (props.qid !== undefined) {
			fetchChatDetails(props.qid);
		}
		// eslint-disable-next-line
	}, [props.qid]);

	// fetch questions when page is changed
	useEffect(() => {
		axios
			.get(`${serverURL}/api/questions?slideID=${props.sid}&pageNum=${props.pageNum}`)
			.then((res) => {
				setState('list');
				setQuestions(sortQuestions(res.data, sorting));
			})
			.catch((err) => {
				console.error(err);
			});
		// eslint-disable-next-line
	}, [props.sid, props.pageNum]);

	// render math in chat details
	useEffect(() => {
		if (state === 'chat-details') window.MathJax.typeset();
	});

	/**
	 * change managing to opposite value
	 */
	const changeManageStatus = () => {
		setManaging(!managing);
	};

	/**
	 * go to create new chat ui
	 */
	const createNewChat = () => {
		setState('new-chat');
		props.setSlideDrawing(false);
		setDrawing(false);
	};

	/**
	 * send new question to server
	 */
	const sendNewQuestion = () => {
		if (!titleRef.current.value) {
			window.alert(`Question title can't be empty.`);
			return;
		}
		let canvasData = drawing ? props.canvasComponentRef.current.lines : undefined;
		axios
			.post(`${serverURL}/api/addQuestion/`, {
				sid: props.sid,
				pageNum: props.pageNum,
				title: titleRef.current.value,
				body: bodyRef.current.value,
				user: getDisplayName(),
				drawing: canvasData,
			})
			.then((res) => {
				backToList();
			})
			.catch((err) => {
				console.error(err);
			});
	};

	/**
	 * send new chat to server
	 */
	const sendNewChat = () => {
		if (!chatRef.current.value){
			return;
		}
		axios
			.post(`${serverURL}/api/addChat/`, {
				sid: props.sid,
				pageNum: props.pageNum,
				qid: qid,
				body: chatRef.current.value,
				user: getDisplayName(),
			})
			.then((res) => {
				chatRef.current.value = '';
				fetchChatDetails(qid);
			})
			.catch((err) => {
				console.error(err);
			});
	};

	/**
	 * fetch question list from server
	 */
	const fetchChatList = async () => {
		axios
			.get(`${serverURL}/api/questions?slideID=${props.sid}&pageNum=${props.pageNum}`)
			.then((res) => {
				setQuestions(sortQuestions(res.data, sorting));
			})
			.catch((err) => {
				console.error(err);
			});
	};

	/**
	 * apply new sorting method
	 * @param {String} newSort new sorting method (update/create)
	 */
	const applySort = (newSort) => {
		if (newSort !== sorting) {
			setQuestions(sortQuestions(questions, newSort));
			setSorting(newSort);
		}
	};

	/**
	 * fetch chat list from server
	 * @param {number} qid question ID
	 */
	const fetchChatDetails = (qid) => {
		axios
			.get(`${serverURL}/api/chats?slideID=${props.sid}&pageNum=${props.pageNum}&qid=${qid}`)
			.then((res) => {
				setQid(qid);
				setQuestionTitle(res.data.title);
				setChatDetails(res.data.chats);
				setState('chat-details');
				window.history.replaceState(null, null, `#${props.pageNum}-${qid}`);
				if (res.data.drawing && props.drawable) {
					props.setSlideDrawing(true);
					props.canvasComponentRef.current.setState({ readOnly: true });
					props.canvasComponentRef.current.lines = res.data.drawing;
					props.canvasComponentRef.current.redraw();
				}
			})
			.catch((err) => {
				console.error(err);
			});
	};

	/**
	 * endorse chat and send to server
	 * @param {number} cid chat ID
	 */
	const endorseChat = (cid) => {
		axios
			.post(`${serverURL}/api/endorse/`, {
				sid: props.sid,
				pageNum: props.pageNum,
				qid: qid,
				cid: cid,
			})
			.then((res) => {
				fetchChatDetails(qid);
			})
			.catch((err) => {
				console.error(err);
			});
	};

	/**
	 * like chat and send to server
	 * @param {number} cid chat ID
	 */
	const likeChat = (cid) => {
		axios
			.post(`${serverURL}/api/like/`, {
				sid: props.sid,
				pageNum: props.pageNum,
				qid: qid,
				cid: cid,
				user: getDisplayName(),
			})
			.then((res) => {
				fetchChatDetails(qid);
			})
			.catch((err) => {
				console.error(err);
			});
	};

	/**
	 *  onClick handler for back button to go back to the chat list
	 */
	const backToList = () => {
		fetchChatList()
			.then(() => {
				setState('list');
				props.setSlideDrawing(false);
				window.history.replaceState(null, null, `#${props.pageNum}`);
			})
			.catch((err) => console.error(err));
	};

	/**
	 * delete a question
	 * @param {*} e onClick event
	 * @param {*} question question to delete
	 */
	const deleteQuestion = (e, question) => {
		e.stopPropagation();
		if (!window.confirm(`Are you sure to delete "${question.title}"?`)) return;

		axios
			.delete(`${serverURL}/api/question?sid=${props.sid}&qid=${question.id}&pageNum=${props.pageNum}`)
			.then((res) => {
				backToList();
			})
			.catch((err) => {
				console.error(err);
			});
	};

	/**
	 * delete a chat
	 * @param {*} e onClick event
	 * @param {number} cid chat ID
	 */
	const deleteChat = (e, cid) => {
		e.stopPropagation();
		if (!window.confirm(`Are you sure to delete this chat?`)) return;

		axios
			.delete(`${serverURL}/api/chat?sid=${props.sid}&qid=${qid}&pageNum=${props.pageNum}&cid=${cid}`)
			.then((res) => {
				fetchChatDetails(qid);
			})
			.catch((err) => {
				console.error(err);
			});
	};

	/**
	 * start drawing
	 * @param {*} e onClick event
	 */
	const startDrawing = (e) => {
		setDrawing(true);
		props.setSlideDrawing(true);
	};

	/**
	 * cancel drawing
	 * @param {*} e onClick event
	 */
	const cancelDrawing = (e) => {
		setDrawing(false);
		props.canvasComponentRef.current.clear();
		props.setSlideDrawing(false);
	};

	let content, title;
	switch (state) {
		case 'list': // list of all chat threads
			title = 'Discussion';

			let chats = [
				<div className='new-chat-btn-row' key={-1}>
					<Button variant='contained' onClick={createNewChat}>
						Ask a new question
					</Button>
				</div>,
				<div className='sort-select-row' key={-2}>
					sort by:
					<span className={sorting === 'update' ? 'selected' : ''} onClick={(e) => applySort('update')}>
						Last update
					</span>
					<span className={sorting === 'create' ? 'selected' : ''} onClick={(e) => applySort('create')}>
						Creation
					</span>
				</div>,
			];

			for (let i = 0; i < questions.length; i++) {
				if (!questions[i]) {
					continue;
				}
				let id = questions[i].id;
				chats.push(
					<div className='chat' key={i} onClick={(e) => fetchChatDetails(id)}>
						<div className='title-row'>
							<div className='title'>{questions[i].title}</div>
							<div className='icons'>
								{questions[i].status === 'solved' ? (
									<span className='material-icons endorsed icon'>verified</span>
								) : null}
								{managing ? (
									<span className='material-icons delete icon' onClick={(e) => deleteQuestion(e, questions[i])}>
										delete_forever
									</span>
								) : null}
							</div>
						</div>
						<div className='info'>
							<div className='author'>{questions[i].user}</div>
							<div className='time'>{formatTime(questions[i].time)}</div>
						</div>
					</div>
				);
			}
			content = <div className='chat-list'>{chats}</div>;
			break;

		// view for creating a new chat thread
		case 'new-chat':
			title = 'Ask a new question';
			content = (
				<div className='new-chat-form' key={-1}>
					<div>
						<TextField
							variant='outlined'
							id={`new-title`}
							placeholder='Title: briefly summarize your question'
							inputRef={titleRef}
						/>
					</div>
					<div>
						<TextField
							variant='outlined'
							id={`new-body`}
							multiline
							rows='6'
							placeholder='Describe your question in more details'
							inputRef={bodyRef}
						/>
					</div>
					{props.drawable ? (
						<div>
							{drawing ? (
								<span onClick={cancelDrawing} className='add-drawing-btn'>
									cancel drawing
								</span>
							) : (
								<span onClick={startDrawing} className='add-drawing-btn'>
									Add some drawing to slide&nbsp;<span className='material-icons'>edit</span>
								</span>
							)}
						</div>
					) : (
						<div></div>
					)}

					<div>
						<Button variant='contained' color='primary' onClick={sendNewQuestion}>
							Send
						</Button>
					</div>
				</div>
			);
			break;

		// the content of the chat thread
		case 'chat-details':
			title = questionTitle;
			let chatsList = [
				<div className='title' key={-2}>
					{title}
				</div>,
			];
			for (let i = 0; i < chatDetails.length; i++) {
				let message = chatDetails[i];
				if (!message) {
					continue;
				}

				let endorsements =
					message.endorsement && message.endorsement.length > 0 ? (
						<div className='endorsement'>{`Endorsed by ${formatNames(message.endorsement)}`}</div>
					) : null;

				chatsList.push(
					<div className='chat' key={i}>
						<div className='info'>
							<div>
								<span className='author'>{message.user}</span>
								<span className='time'>{formatTime(message.time)}</span>
							</div>
							<div className='icons'>
								{message.endorsement.length ? (
									<span className='material-icons endorsed icon' onClick={(e) => endorseChat(i)}>
										verified
									</span>
								) : props.isInstructor ? (
									<span className='material-icons not-endorsed icon' onClick={(e) => endorseChat(i)}>
										verified
									</span>
								) : null}
								<span className={`icon ${message.likes.length ? 'liked' : 'nobody-liked'}`}>
									<span>{message.likes.length ? message.likes.length : ''}</span>
									<span className='material-icons' onClick={(e) => likeChat(i)}>
										favorite
									</span>
								</span>
								{managing && i > 0 ? (
									<span className='material-icons delete icon' onClick={(e) => deleteChat(e, i)}>
										delete_forever
									</span>
								) : null}
							</div>
						</div>
						<div className='body' dangerouslySetInnerHTML={{ __html: md.render(message.body) }}></div>
						<div className='info-bottom'>{endorsements}</div>
					</div>
				);
			}
			chatsList.push(
				<div className='send-message-bar' key={-1}>
					<TextField variant='outlined' id={`chat-response`} multiline rowsMax='4' inputRef={chatRef} />
					<Button variant='contained' color='primary' onClick={sendNewChat}>
						Send
					</Button>
				</div>
			);
			content = <div className='chat-details'>{chatsList}</div>;
			break;

		default:
			content = <div>something went wrong</div>;
	}

	return (
		<div className='chat-area'>
			<div className='chat-area-title'>
				{state !== 'list' ? (
					<div className='back-button' onClick={(e) => backToList()}>
						<span className='material-icons'>arrow_back_ios</span>
					</div>
				) : (
					<div className='placeholder'>&nbsp;</div>
				)}
				<div className='title'>{title}</div>
				{props.isInstructor ? (
					<span className={`manage ${managing ? 'managing' : ''}`} onClick={changeManageStatus}>
						<span className='material-icons icon'>settings</span>
					</span>
				) : (
					<div className='placeholder'>&nbsp;</div>
				)}
			</div>
			{content}
		</div>
	);
}
