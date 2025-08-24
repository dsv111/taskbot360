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
  previewUrl: string | null = null;
  isProcessing = false;

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
