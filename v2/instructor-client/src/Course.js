import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Button, TextField, CircularProgress } from '@material-ui/core';

import SlideSettings from './SlideSettings';
import { serverURL, fullURL } from './config';
import { formatTime } from './util';

/**
 * A block containing information about one course
 */
export default function Course({ cid, role, creationTime, fetchCourses }) {
	const [course, setCourse] = useState(null);
	const [loading, setLoading] = useState(true);
	const [managing, setManaging] = useState(false);
	const [renaming, setRenaming] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [uploadErr, setUploadErr] = useState(null);
	const [addInstructorRes, setAddInstructorRes] = useState(null);
	const [openModify, setOpenModify] = useState({ open: false });
	const fileUpload = useRef(null);
	const newUserRef = useRef(null);
	const nameRef = useRef(null);

	/**
	 * fetch course information from server
	 */
	const fetchCourse = async () => {
		try {
			let res = await axios.get(`${serverURL}/api/course?id=${cid}`);
			setCourse(res.data);
			setLoading(false);
		} catch (err) {
			console.error(err);
		}
	};

	useEffect(() => {
		fetchCourse();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const uploadPDF = async () => {
		for (let i = 0; i < fileUpload.current.files.length; i++) {
			if (!fileUpload.current.files[i].name.toLocaleLowerCase().endsWith('.pdf')) {
				alert('Please upload a PDF file');
				return;
			}
			let formData = new FormData();
			formData.append('cid', cid);
			formData.append('anonymity', 'B'); // login required anonymous chat
			formData.append('file', fileUpload.current.files[i]);
			try {
				setUploading(true);
				await axios.post(`${serverURL}/api/addSlide/`, formData);
			} catch (err) {
				setUploadErr(err.message);
			} finally {
				setUploading(false);
				fetchCourse();
			}
		}
	};

	const deleteSlide = async (filename, sid) => {
		if (!window.confirm(`Are you sure to delete "${filename}"?`)) return;
		try {
			await axios.delete(`${serverURL}/api/slide?sid=${sid}`);
		} catch (err) {
			console.log(err);
		} finally {
			fetchCourse();
		}
	};

	/**
	 * invite an instructor to this course
	 */
	const addInstructor = async () => {
		try {
			await axios.post(`${serverURL}/api/addInstructor`, {
				course: cid,
				newUser: newUserRef.current.value,
			});
			setAddInstructorRes(
				<div className='result-ok'>Add instructor "{newUserRef.current.value}" successfully!</div>
			);
		} catch (err) {
			console.error(err);
			if (err.response && err.response.status === 403) {
				setAddInstructorRes(
					<div className='result-fail'>{`User "${newUserRef.current.value}" is not registered as an instructor in SlideChat server. If you insist to add this user, please contact the admin of SlideChat server.`}</div>
				);
			} else {
				setAddInstructorRes(<div className='result-fail'>Add instructor failed!</div>);
			}
		} finally {
			fetchCourse();
		}
	};

	/**
	 * toggle managing status
	 */
	const changeManageStatus = () => {
		setAddInstructorRes(null);
		setManaging(!managing);
		setRenaming(false);
	};

	/**
	 * copy string to clipboard
	 * @param {*} str string want to copy
	 */
	const copyToClipboard = (str) => {
		const el = document.createElement('textarea');
		el.value = str;
		el.setAttribute('readonly', '');
		el.style.visibility = false;
		document.body.appendChild(el);
		el.select();
		document.execCommand('copy');
		document.body.removeChild(el);
	};

	/**
	 * open slide settings for a given slide
	 * @param {*} filename slide filename
	 * @param {*} sid slide ID
	 */
	const modifySlide = (filename, sid) => {
		setOpenModify({ open: true, filename: filename, sid: sid });
	};

	const changeCourseName = () => {
		axios
			.post(`${serverURL}/api/updateCourseName`, {
				cid: cid,
				name: nameRef.current.value,
			})
			.then((res) => {
				fetchCourse();
				setRenaming(false);
			})
			.catch((err) => {
				console.log(err);
			});
	};

	const deleteCourse = () => {
		if (!window.confirm(`Are you sure to delete course ${course.name}?`)) return;

		axios
			.delete(`${serverURL}/api/course?cid=${cid}`)
			.then((res) => {
				fetchCourses();
			})
			.catch((err) => {
				console.log(err);
			});
	};

	if (loading)
		return (
			<div className='course'>
				<div className='loading'>
					<CircularProgress />
				</div>
			</div>
		);

	return (
		<div className='course'>
			<div className='title'>
				{managing ? (
					renaming ? (
						<div className='title-name'>
							<TextField placeholder='Course Name' defaultValue={course.name} inputRef={nameRef} />
							<span className='material-icons icon confirm' onClick={changeCourseName}>
								check
							</span>
						</div>
					) : (
						<div className='title-name'>
							{course.name}
							<span
								className='material-icons icon rename'
								onClick={() => {
									setRenaming(true);
								}}>
								create
							</span>
						</div>
					)
				) : (
					<span>{course.name}</span>
				)}

				{role === 'instructor' ? (
					<div className='manage-icons'>
						{managing ? (
							<span className='material-icons delete icon' onClick={deleteCourse}>
								delete_forever
							</span>
						) : null}
						<span className={`manage ${managing ? 'managing' : ''}`} onClick={changeManageStatus}>
							<span className='material-icons icon'>settings</span>
						</span>
					</div>
				) : (
					<span>&nbsp;</span>
				)}
			</div>
			<div className='creation-time'>{'Created: ' + formatTime(creationTime)}</div>
			<div className='slides'>
				{course.slides.map((slide) => {
					let link = `${fullURL()}/${slide.id}`;
					return (
						<div key={slide.id} className='slide-item'>
							<div className='left'>
								<a className='slide-link' href={link}>
									{slide.filename}
								</a>
								<div className='time-row'>Last activity: {formatTime(slide.lastActive)}</div>
							</div>
							{managing ? (
								<div className='btns'>
									<Button
										className='slide-delete-btn'
										variant='outlined'
										color='primary'
										onClick={(e) => modifySlide(slide.filename, slide.id)}>
										Modify
									</Button>
									<Button
										className='slide-delete-btn'
										variant='outlined'
										color='secondary'
										onClick={(e) => deleteSlide(slide.filename, slide.id)}>
										Delete
									</Button>
								</div>
							) : (
								<div className='btns'>
									<Button variant='outlined' color='primary' onClick={(e) => copyToClipboard(link)}>
										Copy link
									</Button>
								</div>
							)}
						</div>
					);
				})}
			</div>

			{managing ? (
				<>
					<div className='upload-bar'>
						<input type='file' name='file' ref={fileUpload} accept='.pdf' multiple />
						<Button onClick={uploadPDF} disabled={uploading} variant='contained' color='primary'>
							Upload
						</Button>
						{uploading ? <CircularProgress /> : null}
					</div>
					<div className='result-fail'>{uploadErr}</div>
				</>
			) : null}

			<div className='instructors'>
				<strong>Instructors: </strong>
				{course.instructors.join(', ')}
			</div>
			{managing ? (
				<>
					<div className='addInstructor-bar'>
						<TextField
							variant='outlined'
							id={`new-instructor`}
							placeholder='utorid'
							inputRef={newUserRef}
						/>
						<Button
							id='fileSubmit'
							variant='contained'
							color='primary'
							onClick={(e) => addInstructor(course.cid)}>
							Add Instructor
						</Button>
					</div>
					{addInstructorRes}
				</>
			) : null}

			{openModify.open ? (
				<SlideSettings
					open={openModify.open}
					onClose={(_) => setOpenModify({ open: false })}
					sid={openModify.sid}
				/>
			) : null}
		</div>
	);
}
