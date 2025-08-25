import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AiService } from '../../app/core/ai.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [ CommonModule,
    FormsModule,
    ReactiveFormsModule],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css'
})
export class SignupComponent {
  signupForm!: FormGroup;
  loginForm!: FormGroup;

  previewUrl: string | null = null;
  isProcessing = false;
  isUser = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private aiService: AiService
  ) {
    this.signupForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      gender: ['', Validators.required],
      profilePic: [null, Validators.required]
    });

     // new login form
  this.loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });
  }

  ngOnInit() {
    // Redirect if already logged in
const user = localStorage.getItem("loggedInUser");
console.log(user,"loggedInUser");

if (user) { 
  this.isUser = true
  this.router.navigate(['/home']);
 }  

  }

  // When user selects profile pic
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.uploadAndEnhance(file);
    }
  }

  // AI Enhancement logic
  async uploadAndEnhance(file: File) {
    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const base64Image = e.target.result;
      this.isProcessing = true;

      try {
        // Enhance via AI
        const enhancedPic = await this.aiService.enhanceImage(base64Image);
        this.previewUrl = enhancedPic;
        this.signupForm.patchValue({ profilePic: enhancedPic });
      } catch (err) {
        console.error("AI enhancement failed, using raw image", err);
        this.previewUrl = base64Image;
        this.signupForm.patchValue({ profilePic: base64Image });
      } finally {
        this.isProcessing = false;
      }
    };
    reader.readAsDataURL(file);
  }

  onLogin() {
  if (this.loginForm.valid) {
    const { email, password } = this.loginForm.value;
    const user = localStorage.getItem("loggedInUser");

    if (user) {
      const parsedUser = JSON.parse(user);
      if (parsedUser.email === email && parsedUser.password === password) {
        this.isUser = true;
        this.router.navigate(['/home']);
      } else {
        alert("Invalid email or password");
      }
    } else {
      alert("No user found. Please sign up first.");
    }
  }
}

  // Handle signup
  onSubmit() {
    if (this.signupForm.valid) {
      const userData = this.signupForm.value;

      // Save user to localStorage (mock backend)
      localStorage.setItem("loggedInUser", JSON.stringify(userData));

      // Navigate to home page
      this.router.navigate(['/home']);
    } else {
      alert("Please fill all mandatory fields");
    }
  }

}
